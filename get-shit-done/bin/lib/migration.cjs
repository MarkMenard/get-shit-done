/**
 * Migration — Detect flat .planning/ layouts and migrate into namespaced .planning/<slug>/
 */

const fs = require('fs');
const path = require('path');
const {
  planningRoot,
  writeActiveFile,
  safeReadFile,
  generateSlugInternal,
  output,
  error,
} = require('./core.cjs');

// Known GSD files that indicate a flat layout when found at .planning/ root
const KNOWN_FILES = ['PROJECT.md', 'ROADMAP.md', 'STATE.md', 'config.json'];

// Slugs that collide with known GSD directory names
const RESERVED_SLUGS = new Set([
  'phases', 'milestones', 'codebase', 'config',
  '.gitignore', '.active',
]);

/**
 * Detect whether .planning/ has a flat (un-namespaced) layout.
 *
 * @param {string} cwd - Working directory
 * @returns {{ needs_migration: boolean, suggested_slug?: string|null, detected_files?: string[] }}
 */
function detectFlatLayout(cwd) {
  const planningDir = path.join(cwd, '.planning');

  // No .planning/ directory at all
  if (!fs.existsSync(planningDir)) {
    return { needs_migration: false };
  }

  // If .active exists with a non-empty slug, already namespaced
  const activeContent = safeReadFile(path.join(planningDir, '.active'));
  if (activeContent && activeContent.trim()) {
    return { needs_migration: false };
  }

  // Scan for known GSD files at the flat root
  const found = KNOWN_FILES.filter(f => fs.existsSync(path.join(planningDir, f)));

  if (found.length === 0) {
    return { needs_migration: false };
  }

  // Flat layout detected - try to derive slug from PROJECT.md title
  let suggestedSlug = null;
  const projectContent = safeReadFile(path.join(planningDir, 'PROJECT.md'));
  if (projectContent) {
    const titleMatch = projectContent.match(/^#\s+(.+)/m);
    if (titleMatch) {
      suggestedSlug = generateSlugInternal(titleMatch[1]);
    }
  }

  return {
    needs_migration: true,
    suggested_slug: suggestedSlug,
    detected_files: found,
  };
}

/**
 * Validate that migration completed successfully.
 *
 * @param {string} cwd - Working directory
 * @param {string} slug - The namespace slug
 * @param {string[]} originalEntries - Entry names that were moved
 * @returns {{ valid: boolean, missing: string[], planning_root_resolved: boolean }}
 */
function validateMigration(cwd, slug, originalEntries) {
  const targetDir = path.join(cwd, '.planning', slug);
  const missing = [];

  for (const entry of originalEntries) {
    if (!fs.existsSync(path.join(targetDir, entry))) {
      missing.push(entry);
    }
  }

  // Check that planningRoot now resolves to the namespaced path
  const resolvedRoot = planningRoot(cwd);
  const rootPointsToSlug = resolvedRoot.endsWith(slug);

  return {
    valid: missing.length === 0 && rootPointsToSlug,
    missing,
    planning_root_resolved: rootPointsToSlug,
  };
}

/**
 * Migrate a flat .planning/ layout into .planning/<slug>/.
 *
 * @param {string} cwd - Working directory
 * @param {string} slug - The namespace slug to migrate into
 * @param {boolean} raw - Whether to output raw value
 */
function cmdMigrate(cwd, slug, raw) {
  const planningDir = path.join(cwd, '.planning');

  // Check .planning/ exists
  if (!fs.existsSync(planningDir)) {
    error('Cannot migrate: .planning/ directory does not exist');
  }

  // Idempotency: if .active exists with a slug, already migrated
  const activeContent = safeReadFile(path.join(planningDir, '.active'));
  if (activeContent && activeContent.trim()) {
    const existingSlug = activeContent.trim();
    output({ migrated: false, reason: 'already_namespaced', slug: existingSlug }, raw);
    return;
  }

  // Validate slug
  if (!slug) {
    error('Slug is required for migration');
  }

  if (RESERVED_SLUGS.has(slug)) {
    error(`Reserved slug "${slug}" cannot be used — collides with known GSD directory names`);
  }

  const targetDir = path.join(planningDir, slug);

  // Collect entries to move (everything except .active, .gitignore, and the target dir itself)
  const skip = new Set(['.active', '.gitignore', slug]);
  let entries;
  try {
    entries = fs.readdirSync(planningDir).filter(e => !skip.has(e));
  } catch (err) {
    error(`Cannot read .planning/ directory: ${err.message}`);
  }

  // Create target directory
  fs.mkdirSync(targetDir, { recursive: true });

  // Move with tracking for rollback
  const moved = [];
  try {
    for (const entry of entries) {
      const src = path.join(planningDir, entry);
      const dst = path.join(targetDir, entry);
      fs.renameSync(src, dst);
      moved.push({ src, dst, entry });
    }
  } catch (err) {
    // Rollback all completed moves in reverse order
    for (const { src, dst } of [...moved].reverse()) {
      try {
        fs.renameSync(dst, src);
      } catch {
        // Best effort rollback
      }
    }
    // Remove the target directory if empty after rollback
    try {
      fs.rmdirSync(targetDir);
    } catch {
      // May not be empty or may not exist
    }
    error(`Migration failed: ${err.message}. Rolled back ${moved.length} moves.`);
  }

  // Update config.json project_slug at new location
  const configPath = path.join(targetDir, 'config.json');
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    config.project_slug = slug;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  } catch {
    // config.json might not exist - that's fine
  }

  // Write .active file
  writeActiveFile(cwd, slug);

  // Validate the migration
  const entryNames = moved.map(m => m.entry);
  const validation = validateMigration(cwd, slug, entryNames);

  output({
    migrated: true,
    slug,
    entries_moved: moved.length,
    validation,
  }, raw);
}

module.exports = { detectFlatLayout, cmdMigrate };

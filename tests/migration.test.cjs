/**
 * GSD Tools Tests - Migration
 *
 * Tests for detectFlatLayout, cmdMigrate, and validateMigration.
 * Covers requirements: MIGR-01, MIGR-03, MIGR-04
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runGsdTools, cleanup } = require('./helpers.cjs');

// ─── Test Helper ────────────────────────────────────────────────────────────

/**
 * Creates a temp project with a flat .planning/ layout:
 * .planning/PROJECT.md, ROADMAP.md, STATE.md, config.json, phases/01-setup/
 */
function createTempFlatProject(opts = {}) {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-migration-'));
  const planningDir = path.join(tmpDir, '.planning');
  fs.mkdirSync(path.join(planningDir, 'phases', '01-setup'), { recursive: true });

  const title = opts.title || 'My Test Project';
  fs.writeFileSync(path.join(planningDir, 'PROJECT.md'), `# ${title}\n\nA test project.\n`);
  fs.writeFileSync(path.join(planningDir, 'ROADMAP.md'), '# Roadmap\n\n## Phase 1: Setup\n');
  fs.writeFileSync(path.join(planningDir, 'STATE.md'), '---\nstatus: executing\n---\n# State\n');
  fs.writeFileSync(path.join(planningDir, 'config.json'), JSON.stringify({ mode: 'yolo' }, null, 2));

  // Add a file inside phases to verify nested structure preservation
  fs.writeFileSync(
    path.join(planningDir, 'phases', '01-setup', '01-01-PLAN.md'),
    '# Plan 01-01\n'
  );

  return tmpDir;
}

// ─── detectFlatLayout tests ─────────────────────────────────────────────────

describe('detectFlatLayout', () => {
  // We test detectFlatLayout by requiring migration.cjs directly
  let detectFlatLayout;
  let tmpDir;

  beforeEach(() => {
    // Require fresh each time to avoid module caching issues
    detectFlatLayout = require('../get-shit-done/bin/lib/migration.cjs').detectFlatLayout;
  });

  afterEach(() => {
    if (tmpDir) cleanup(tmpDir);
    tmpDir = null;
  });

  test('returns needs_migration:false when .planning/ does not exist', () => {
    tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-migration-'));
    const result = detectFlatLayout(tmpDir);
    assert.strictEqual(result.needs_migration, false);
  });

  test('returns needs_migration:false when .planning/ has no known files', () => {
    tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-migration-'));
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    // Empty .planning/ dir - no known GSD files
    const result = detectFlatLayout(tmpDir);
    assert.strictEqual(result.needs_migration, false);
  });

  test('returns needs_migration:false when .active file exists with a slug', () => {
    tmpDir = createTempFlatProject();
    // Write .active file to simulate already-namespaced state
    fs.writeFileSync(path.join(tmpDir, '.planning', '.active'), 'my-project');
    const result = detectFlatLayout(tmpDir);
    assert.strictEqual(result.needs_migration, false);
  });

  test('returns needs_migration:true when known files exist and no .active', () => {
    tmpDir = createTempFlatProject();
    const result = detectFlatLayout(tmpDir);
    assert.strictEqual(result.needs_migration, true);
    assert.ok(Array.isArray(result.detected_files));
    assert.ok(result.detected_files.length > 0);
    assert.ok(result.detected_files.includes('PROJECT.md'));
  });

  test('suggests slug derived from PROJECT.md title', () => {
    tmpDir = createTempFlatProject({ title: 'My Awesome App' });
    const result = detectFlatLayout(tmpDir);
    assert.strictEqual(result.needs_migration, true);
    assert.strictEqual(result.suggested_slug, 'my-awesome-app');
  });

  test('returns suggested_slug:null when PROJECT.md has no title', () => {
    tmpDir = createTempFlatProject();
    // Overwrite PROJECT.md with no heading
    fs.writeFileSync(path.join(tmpDir, '.planning', 'PROJECT.md'), 'No title here.\n');
    const result = detectFlatLayout(tmpDir);
    assert.strictEqual(result.needs_migration, true);
    assert.strictEqual(result.suggested_slug, null);
  });

  test('detects flat layout with only config.json present', () => {
    tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-migration-'));
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ mode: 'yolo' })
    );
    const result = detectFlatLayout(tmpDir);
    assert.strictEqual(result.needs_migration, true);
    assert.deepStrictEqual(result.detected_files, ['config.json']);
  });
});

// ─── cmdMigrate tests (via CLI) ─────────────────────────────────────────────

describe('cmdMigrate', () => {
  let tmpDir;

  afterEach(() => {
    if (tmpDir) cleanup(tmpDir);
    tmpDir = null;
  });

  test('migrates files into slug subdirectory', () => {
    tmpDir = createTempFlatProject();
    const result = runGsdTools('migrate my-project', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.migrated, true);
    assert.strictEqual(output.slug, 'my-project');
    assert.ok(output.entries_moved > 0);

    // Verify files moved to namespace
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'my-project', 'PROJECT.md')));
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'my-project', 'ROADMAP.md')));
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'my-project', 'STATE.md')));
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'my-project', 'config.json')));

    // Verify .active stays at root
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', '.active')));
    const activeContent = fs.readFileSync(path.join(tmpDir, '.planning', '.active'), 'utf-8').trim();
    assert.strictEqual(activeContent, 'my-project');
  });

  test('preserves nested directory structure', () => {
    tmpDir = createTempFlatProject();
    const result = runGsdTools('migrate my-project', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    // phases/01-setup/01-01-PLAN.md should be at my-project/phases/01-setup/01-01-PLAN.md
    const nestedFile = path.join(
      tmpDir, '.planning', 'my-project', 'phases', '01-setup', '01-01-PLAN.md'
    );
    assert.ok(fs.existsSync(nestedFile), 'Nested directory structure not preserved');
  });

  test('is idempotent - returns already_namespaced if .active exists', () => {
    tmpDir = createTempFlatProject();
    // First migration
    const first = runGsdTools('migrate my-project', tmpDir);
    assert.ok(first.success, `First migration failed: ${first.error}`);

    // Second migration attempt
    const second = runGsdTools('migrate my-project', tmpDir);
    assert.ok(second.success, `Second migration failed: ${second.error}`);

    const output = JSON.parse(second.output);
    assert.strictEqual(output.migrated, false);
    assert.strictEqual(output.reason, 'already_namespaced');
  });

  test('rejects reserved slug "phases"', () => {
    tmpDir = createTempFlatProject();
    const result = runGsdTools('migrate phases', tmpDir);
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('reserved') || result.error.includes('Reserved'),
      `Expected reserved slug error, got: ${result.error}`);
  });

  test('rejects reserved slug "config"', () => {
    tmpDir = createTempFlatProject();
    const result = runGsdTools('migrate config', tmpDir);
    assert.strictEqual(result.success, false);
  });

  test('updates config.json project_slug at new location', () => {
    tmpDir = createTempFlatProject();
    runGsdTools('migrate my-project', tmpDir);

    const configPath = path.join(tmpDir, '.planning', 'my-project', 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.strictEqual(config.project_slug, 'my-project');
  });

  test('returns validation in output', () => {
    tmpDir = createTempFlatProject();
    const result = runGsdTools('migrate my-project', tmpDir);
    assert.ok(result.success);

    const output = JSON.parse(result.output);
    assert.ok(output.validation);
    assert.strictEqual(output.validation.valid, true);
    assert.deepStrictEqual(output.validation.missing, []);
    assert.strictEqual(output.validation.planning_root_resolved, true);
  });

  test('fails on missing .planning/ directory', () => {
    tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-migration-'));
    // No .planning/ at all
    const result = runGsdTools('migrate my-project', tmpDir);
    assert.strictEqual(result.success, false);
  });

  test('does not move .gitignore into namespace', () => {
    tmpDir = createTempFlatProject();
    // Add a .gitignore to .planning/
    fs.writeFileSync(path.join(tmpDir, '.planning', '.gitignore'), '.active\n');

    const result = runGsdTools('migrate my-project', tmpDir);
    assert.ok(result.success);

    // .gitignore should stay at root level
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', '.gitignore')));
    // .gitignore should NOT be in namespace
    assert.ok(!fs.existsSync(path.join(tmpDir, '.planning', 'my-project', '.gitignore')));
  });
});

// ─── init migration interception tests ──────────────────────────────────────

describe('init migration interception', () => {
  let tmpDir;

  afterEach(() => {
    if (tmpDir) cleanup(tmpDir);
    tmpDir = null;
  });

  test('init execute-phase on flat layout returns needs_migration', () => {
    tmpDir = createTempFlatProject();
    const result = runGsdTools('init execute-phase 01', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.needs_migration, true);
    assert.ok(output.suggested_slug);
  });

  test('init plan-phase on flat layout returns needs_migration', () => {
    tmpDir = createTempFlatProject();
    const result = runGsdTools('init plan-phase 01', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.needs_migration, true);
  });

  test('init progress on flat layout returns needs_migration', () => {
    tmpDir = createTempFlatProject();
    const result = runGsdTools('init progress', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.needs_migration, true);
  });

  test('init after migration returns normal output', () => {
    tmpDir = createTempFlatProject();

    // Perform migration
    const migrateResult = runGsdTools('migrate my-project', tmpDir);
    assert.ok(migrateResult.success, `Migration failed: ${migrateResult.error}`);

    // Now init progress should return normal output
    const result = runGsdTools('init progress', tmpDir);
    assert.ok(result.success, `Init failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(!output.needs_migration, 'Should not have needs_migration after migration');
    assert.ok(output.planning_root, 'Should have planning_root field (normal init output)');
  });

  test('migrate command end-to-end', () => {
    tmpDir = createTempFlatProject();
    const result = runGsdTools('migrate test-project', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.migrated, true);
    assert.ok(output.entries_moved > 0);

    // Verify files exist at .planning/test-project/
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'test-project', 'PROJECT.md')));
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'test-project', 'ROADMAP.md')));
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'test-project', 'STATE.md')));
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'test-project', 'config.json')));
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'test-project', 'phases', '01-setup', '01-01-PLAN.md')));

    // Verify .active file contains "test-project"
    const activeContent = fs.readFileSync(path.join(tmpDir, '.planning', '.active'), 'utf-8').trim();
    assert.strictEqual(activeContent, 'test-project');

    // Verify .gitignore still at .planning/ root (not moved into namespace)
    // Note: .gitignore may or may not exist, but if it does it should be at root
    // The createTempFlatProject doesn't create .gitignore by default, but the migration
    // creates one via writeActiveFile
  });

  test('migrate command idempotent', () => {
    tmpDir = createTempFlatProject();

    // First migration
    const first = runGsdTools('migrate test-project', tmpDir);
    assert.ok(first.success, `First migration failed: ${first.error}`);

    // Second migration
    const second = runGsdTools('migrate test-project', tmpDir);
    assert.ok(second.success, `Second migration failed: ${second.error}`);

    const output = JSON.parse(second.output);
    assert.strictEqual(output.migrated, false);
    assert.strictEqual(output.reason, 'already_namespaced');
  });
});

// ─── validateMigration tests (indirect through cmdMigrate output) ───────────

describe('validateMigration', () => {
  let tmpDir;

  afterEach(() => {
    if (tmpDir) cleanup(tmpDir);
    tmpDir = null;
  });

  test('validation confirms all entries exist at new paths', () => {
    tmpDir = createTempFlatProject();
    const result = runGsdTools('migrate test-proj', tmpDir);
    assert.ok(result.success);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.validation.valid, true);
    assert.strictEqual(output.validation.missing.length, 0);
  });

  test('validation confirms planningRoot resolves correctly', () => {
    tmpDir = createTempFlatProject();
    const result = runGsdTools('migrate test-proj', tmpDir);
    assert.ok(result.success);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.validation.planning_root_resolved, true);
  });
});

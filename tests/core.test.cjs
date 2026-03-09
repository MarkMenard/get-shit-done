/**
 * GSD Tools Tests - core.cjs
 *
 * Tests for the foundational module's exports including regressions
 * for known bugs (REG-01: loadConfig model_overrides, REG-02: getRoadmapPhaseInternal export).
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  loadConfig,
  resolveModelInternal,
  MODEL_PROFILES,
  escapeRegex,
  generateSlugInternal,
  normalizePhaseName,
  comparePhaseNum,
  safeReadFile,
  pathExistsInternal,
  getMilestoneInfo,
  getMilestonePhaseFilter,
  getRoadmapPhaseInternal,
  searchPhaseInDir,
  findPhaseInternal,
  getArchivedPhaseDirs,
  planningRoot,
  writeActiveFile,
  listNamespaces,
  detectNeedsSelection,
} = require('../get-shit-done/bin/lib/core.cjs');
const { createTempMultiProject, cleanup } = require('./helpers.cjs');

// ─── loadConfig ────────────────────────────────────────────────────────────────

describe('loadConfig', () => {
  let tmpDir;
  let originalCwd;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-core-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    originalCwd = process.cwd();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeConfig(obj) {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify(obj, null, 2)
    );
  }

  test('returns defaults when config.json is missing', () => {
    const config = loadConfig(tmpDir);
    assert.strictEqual(config.model_profile, 'balanced');
    assert.strictEqual(config.commit_docs, true);
    assert.strictEqual(config.research, true);
    assert.strictEqual(config.plan_checker, true);
    assert.strictEqual(config.brave_search, false);
    assert.strictEqual(config.parallelization, true);
    assert.strictEqual(config.nyquist_validation, true);
  });

  test('reads model_profile from config.json', () => {
    writeConfig({ model_profile: 'quality' });
    const config = loadConfig(tmpDir);
    assert.strictEqual(config.model_profile, 'quality');
  });

  test('reads nested config keys', () => {
    writeConfig({ planning: { commit_docs: false } });
    const config = loadConfig(tmpDir);
    assert.strictEqual(config.commit_docs, false);
  });

  test('reads branching_strategy from git section', () => {
    writeConfig({ git: { branching_strategy: 'per-phase' } });
    const config = loadConfig(tmpDir);
    assert.strictEqual(config.branching_strategy, 'per-phase');
  });

  // Bug: loadConfig previously omitted model_overrides from return value
  test('returns model_overrides when present (REG-01)', () => {
    writeConfig({ model_overrides: { 'gsd-executor': 'opus' } });
    const config = loadConfig(tmpDir);
    assert.deepStrictEqual(config.model_overrides, { 'gsd-executor': 'opus' });
  });

  test('returns model_overrides as null when not in config', () => {
    writeConfig({ model_profile: 'balanced' });
    const config = loadConfig(tmpDir);
    assert.strictEqual(config.model_overrides, null);
  });

  test('returns defaults when config.json contains invalid JSON', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      'not valid json {{{{'
    );
    const config = loadConfig(tmpDir);
    assert.strictEqual(config.model_profile, 'balanced');
    assert.strictEqual(config.commit_docs, true);
  });

  test('handles parallelization as boolean', () => {
    writeConfig({ parallelization: false });
    const config = loadConfig(tmpDir);
    assert.strictEqual(config.parallelization, false);
  });

  test('handles parallelization as object with enabled field', () => {
    writeConfig({ parallelization: { enabled: false } });
    const config = loadConfig(tmpDir);
    assert.strictEqual(config.parallelization, false);
  });

  test('prefers top-level keys over nested keys', () => {
    writeConfig({ commit_docs: false, planning: { commit_docs: true } });
    const config = loadConfig(tmpDir);
    assert.strictEqual(config.commit_docs, false);
  });
});

// ─── resolveModelInternal ──────────────────────────────────────────────────────

describe('resolveModelInternal', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-core-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeConfig(obj) {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify(obj, null, 2)
    );
  }

  describe('model profile structural validation', () => {
    test('all known agents resolve to a valid string for each profile', () => {
      const knownAgents = ['gsd-planner', 'gsd-executor', 'gsd-phase-researcher', 'gsd-codebase-mapper'];
      const profiles = ['quality', 'balanced', 'budget'];
      const validValues = ['inherit', 'sonnet', 'haiku', 'opus'];

      for (const profile of profiles) {
        writeConfig({ model_profile: profile });
        for (const agent of knownAgents) {
          const result = resolveModelInternal(tmpDir, agent);
          assert.ok(
            validValues.includes(result),
            `profile=${profile} agent=${agent} returned unexpected value: ${result}`
          );
        }
      }
    });
  });

  describe('override precedence', () => {
    test('per-agent override takes precedence over profile', () => {
      writeConfig({
        model_profile: 'balanced',
        model_overrides: { 'gsd-executor': 'haiku' },
      });
      assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-executor'), 'haiku');
    });

    test('opus override resolves to inherit', () => {
      writeConfig({
        model_overrides: { 'gsd-executor': 'opus' },
      });
      assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-executor'), 'inherit');
    });

    test('agents not in override fall back to profile', () => {
      writeConfig({
        model_profile: 'quality',
        model_overrides: { 'gsd-executor': 'haiku' },
      });
      // gsd-planner not overridden, should use quality profile -> opus -> inherit
      assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-planner'), 'inherit');
    });
  });

  describe('edge cases', () => {
    test('returns sonnet for unknown agent type', () => {
      writeConfig({ model_profile: 'balanced' });
      assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-nonexistent'), 'sonnet');
    });

    test('defaults to balanced profile when model_profile missing', () => {
      writeConfig({});
      // balanced profile, gsd-planner -> opus -> inherit
      assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-planner'), 'inherit');
    });
  });
});

// ─── escapeRegex ───────────────────────────────────────────────────────────────

describe('escapeRegex', () => {
  test('escapes dots', () => {
    assert.strictEqual(escapeRegex('file.txt'), 'file\\.txt');
  });

  test('escapes all special regex characters', () => {
    const input = '1.0 (alpha) [test] {ok} $100 ^start end$ a+b a*b a?b pipe|or back\\slash';
    const result = escapeRegex(input);
    // Verify each special char is escaped
    assert.ok(result.includes('\\.'));
    assert.ok(result.includes('\\('));
    assert.ok(result.includes('\\)'));
    assert.ok(result.includes('\\['));
    assert.ok(result.includes('\\]'));
    assert.ok(result.includes('\\{'));
    assert.ok(result.includes('\\}'));
    assert.ok(result.includes('\\$'));
    assert.ok(result.includes('\\^'));
    assert.ok(result.includes('\\+'));
    assert.ok(result.includes('\\*'));
    assert.ok(result.includes('\\?'));
    assert.ok(result.includes('\\|'));
    assert.ok(result.includes('\\\\'));
  });

  test('handles empty string', () => {
    assert.strictEqual(escapeRegex(''), '');
  });

  test('returns plain string unchanged', () => {
    assert.strictEqual(escapeRegex('hello'), 'hello');
  });
});

// ─── generateSlugInternal ──────────────────────────────────────────────────────

describe('generateSlugInternal', () => {
  test('converts text to lowercase kebab-case', () => {
    assert.strictEqual(generateSlugInternal('Hello World'), 'hello-world');
  });

  test('removes special characters', () => {
    assert.strictEqual(generateSlugInternal('core.cjs Tests!'), 'core-cjs-tests');
  });

  test('trims leading and trailing hyphens', () => {
    assert.strictEqual(generateSlugInternal('---hello---'), 'hello');
  });

  test('returns null for null input', () => {
    assert.strictEqual(generateSlugInternal(null), null);
  });

  test('returns null for empty string', () => {
    assert.strictEqual(generateSlugInternal(''), null);
  });
});

// ─── normalizePhaseName ────────────────────────────────────────────────────────

describe('normalizePhaseName', () => {
  test('pads single digit', () => {
    assert.strictEqual(normalizePhaseName('1'), '01');
  });

  test('preserves double digit', () => {
    assert.strictEqual(normalizePhaseName('12'), '12');
  });

  test('handles letter suffix', () => {
    assert.strictEqual(normalizePhaseName('1A'), '01A');
  });

  test('handles decimal phases', () => {
    assert.strictEqual(normalizePhaseName('2.1'), '02.1');
  });

  test('handles multi-level decimals', () => {
    assert.strictEqual(normalizePhaseName('1.2.3'), '01.2.3');
  });

  test('returns non-matching input unchanged', () => {
    assert.strictEqual(normalizePhaseName('abc'), 'abc');
  });
});

// ─── comparePhaseNum ───────────────────────────────────────────────────────────

describe('comparePhaseNum', () => {
  test('sorts integer phases numerically', () => {
    assert.ok(comparePhaseNum('1', '2') < 0);
    assert.ok(comparePhaseNum('10', '2') > 0);
  });

  test('sorts letter suffixes', () => {
    assert.ok(comparePhaseNum('12', '12A') < 0);
    assert.ok(comparePhaseNum('12A', '12B') < 0);
  });

  test('sorts decimal phases', () => {
    assert.ok(comparePhaseNum('2', '2.1') < 0);
    assert.ok(comparePhaseNum('2.1', '2.2') < 0);
  });

  test('handles multi-level decimals', () => {
    assert.ok(comparePhaseNum('1.1', '1.1.2') < 0);
    assert.ok(comparePhaseNum('1.1.2', '1.2') < 0);
  });

  test('returns 0 for equal phases', () => {
    assert.strictEqual(comparePhaseNum('1', '1'), 0);
    assert.strictEqual(comparePhaseNum('2.1', '2.1'), 0);
  });
});

// ─── safeReadFile ──────────────────────────────────────────────────────────────

describe('safeReadFile', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-core-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('reads existing file', () => {
    const filePath = path.join(tmpDir, 'test.txt');
    fs.writeFileSync(filePath, 'hello world');
    assert.strictEqual(safeReadFile(filePath), 'hello world');
  });

  test('returns null for missing file', () => {
    assert.strictEqual(safeReadFile('/nonexistent/path/file.txt'), null);
  });
});

// ─── pathExistsInternal ────────────────────────────────────────────────────────

describe('pathExistsInternal', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-core-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('returns true for existing path', () => {
    assert.strictEqual(pathExistsInternal(tmpDir, '.planning'), true);
  });

  test('returns false for non-existing path', () => {
    assert.strictEqual(pathExistsInternal(tmpDir, 'nonexistent'), false);
  });

  test('handles absolute paths', () => {
    assert.strictEqual(pathExistsInternal(tmpDir, tmpDir), true);
  });
});

// ─── getMilestoneInfo ──────────────────────────────────────────────────────────

describe('getMilestoneInfo', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-core-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('extracts version and name from roadmap', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Roadmap\n\n## Roadmap v1.2: My Cool Project\n\nSome content'
    );
    const info = getMilestoneInfo(tmpDir);
    assert.strictEqual(info.version, 'v1.2');
    assert.strictEqual(info.name, 'My Cool Project');
  });

  test('returns defaults when roadmap missing', () => {
    const info = getMilestoneInfo(tmpDir);
    assert.strictEqual(info.version, 'v1.0');
    assert.strictEqual(info.name, 'milestone');
  });

  test('returns active milestone when shipped milestone is collapsed in details block', () => {
    const roadmap = [
      '# Milestones',
      '',
      '| Version | Status |',
      '|---------|--------|',
      '| v0.1    | Shipped |',
      '| v0.2    | Active |',
      '',
      '<details>',
      '<summary>v0.1 — Legacy Feature Parity (Shipped)</summary>',
      '',
      '## Roadmap v0.1: Legacy Feature Parity',
      '',
      '### Phase 1: Core Setup',
      'Some content about phase 1',
      '',
      '</details>',
      '',
      '## Roadmap v0.2: Dashboard Overhaul',
      '',
      '### Phase 8: New Dashboard Layout',
      'Some content about phase 8',
    ].join('\n');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), roadmap);
    const info = getMilestoneInfo(tmpDir);
    assert.strictEqual(info.version, 'v0.2');
    assert.strictEqual(info.name, 'Dashboard Overhaul');
  });

  test('returns active milestone when multiple shipped milestones exist in details blocks', () => {
    const roadmap = [
      '# Milestones',
      '',
      '| Version | Status |',
      '|---------|--------|',
      '| v0.1    | Shipped |',
      '| v0.2    | Shipped |',
      '| v0.3    | Active |',
      '',
      '<details>',
      '<summary>v0.1 — Initial Release (Shipped)</summary>',
      '',
      '## Roadmap v0.1: Initial Release',
      '',
      '</details>',
      '',
      '<details>',
      '<summary>v0.2 — Feature Expansion (Shipped)</summary>',
      '',
      '## Roadmap v0.2: Feature Expansion',
      '',
      '</details>',
      '',
      '## Roadmap v0.3: Performance Tuning',
      '',
      '### Phase 12: Optimize Queries',
    ].join('\n');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), roadmap);
    const info = getMilestoneInfo(tmpDir);
    assert.strictEqual(info.version, 'v0.3');
    assert.strictEqual(info.name, 'Performance Tuning');
  });

  test('returns defaults when roadmap has no heading matches', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Roadmap\n\nSome content without version headings'
    );
    const info = getMilestoneInfo(tmpDir);
    assert.strictEqual(info.version, 'v1.0');
    assert.strictEqual(info.name, 'milestone');
  });
});

// ─── searchPhaseInDir ──────────────────────────────────────────────────────────

describe('searchPhaseInDir', () => {
  let tmpDir;
  let phasesDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-core-test-'));
    phasesDir = path.join(tmpDir, 'phases');
    fs.mkdirSync(phasesDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('finds phase directory by normalized prefix', () => {
    fs.mkdirSync(path.join(phasesDir, '01-foundation'));
    const result = searchPhaseInDir(phasesDir, '.planning/phases', '01');
    assert.strictEqual(result.found, true);
    assert.strictEqual(result.phase_number, '01');
    assert.strictEqual(result.phase_name, 'foundation');
  });

  test('returns plans and summaries', () => {
    const phaseDir = path.join(phasesDir, '01-foundation');
    fs.mkdirSync(phaseDir);
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary');
    const result = searchPhaseInDir(phasesDir, '.planning/phases', '01');
    assert.ok(result.plans.includes('01-01-PLAN.md'));
    assert.ok(result.summaries.includes('01-01-SUMMARY.md'));
    assert.strictEqual(result.incomplete_plans.length, 0);
  });

  test('identifies incomplete plans', () => {
    const phaseDir = path.join(phasesDir, '01-foundation');
    fs.mkdirSync(phaseDir);
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan 1');
    fs.writeFileSync(path.join(phaseDir, '01-02-PLAN.md'), '# Plan 2');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary 1');
    const result = searchPhaseInDir(phasesDir, '.planning/phases', '01');
    assert.strictEqual(result.incomplete_plans.length, 1);
    assert.ok(result.incomplete_plans.includes('01-02-PLAN.md'));
  });

  test('detects research and context files', () => {
    const phaseDir = path.join(phasesDir, '01-foundation');
    fs.mkdirSync(phaseDir);
    fs.writeFileSync(path.join(phaseDir, '01-RESEARCH.md'), '# Research');
    fs.writeFileSync(path.join(phaseDir, '01-CONTEXT.md'), '# Context');
    const result = searchPhaseInDir(phasesDir, '.planning/phases', '01');
    assert.strictEqual(result.has_research, true);
    assert.strictEqual(result.has_context, true);
  });

  test('returns null when phase not found', () => {
    fs.mkdirSync(path.join(phasesDir, '01-foundation'));
    const result = searchPhaseInDir(phasesDir, '.planning/phases', '99');
    assert.strictEqual(result, null);
  });

  test('generates phase_slug from directory name', () => {
    fs.mkdirSync(path.join(phasesDir, '01-core-cjs-tests'));
    const result = searchPhaseInDir(phasesDir, '.planning/phases', '01');
    assert.strictEqual(result.phase_slug, 'core-cjs-tests');
  });
});

// ─── findPhaseInternal ─────────────────────────────────────────────────────────

describe('findPhaseInternal', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-core-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('finds phase in current phases directory', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-foundation'));
    const result = findPhaseInternal(tmpDir, '1');
    assert.strictEqual(result.found, true);
    assert.strictEqual(result.phase_number, '01');
  });

  test('returns null for non-existent phase', () => {
    const result = findPhaseInternal(tmpDir, '99');
    assert.strictEqual(result, null);
  });

  test('returns null for null phase', () => {
    const result = findPhaseInternal(tmpDir, null);
    assert.strictEqual(result, null);
  });

  test('searches archived milestones when not in current', () => {
    // Create archived milestone structure (no current phase match)
    const archiveDir = path.join(tmpDir, '.planning', 'milestones', 'v1.0-phases', '01-foundation');
    fs.mkdirSync(archiveDir, { recursive: true });
    const result = findPhaseInternal(tmpDir, '1');
    assert.strictEqual(result.found, true);
    assert.strictEqual(result.archived, 'v1.0');
  });
});

// ─── getRoadmapPhaseInternal ───────────────────────────────────────────────────

describe('getRoadmapPhaseInternal', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-core-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // Bug: getRoadmapPhaseInternal was missing from module.exports
  test('is exported from core.cjs (REG-02)', () => {
    assert.strictEqual(typeof getRoadmapPhaseInternal, 'function');
    // Also verify it works with a real roadmap (note: goal regex expects **Goal:** with colon inside bold)
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '### Phase 1: Foundation\n**Goal:** Build the base\n'
    );
    const result = getRoadmapPhaseInternal(tmpDir, '1');
    assert.strictEqual(result.found, true);
    assert.strictEqual(result.phase_name, 'Foundation');
    assert.strictEqual(result.goal, 'Build the base');
  });

  test('extracts phase name and goal from roadmap', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '### Phase 2: API Layer\n**Goal:** Create REST endpoints\n**Depends on**: Phase 1\n'
    );
    const result = getRoadmapPhaseInternal(tmpDir, '2');
    assert.strictEqual(result.phase_name, 'API Layer');
    assert.strictEqual(result.goal, 'Create REST endpoints');
  });

  test('returns null goal when Goal uses colon-outside-bold format', () => {
    // Actual ROADMAP.md uses **Goal**: (colon outside bold) which the regex does not match
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '### Phase 1: Foundation\n**Goal**: Build the base\n'
    );
    const result = getRoadmapPhaseInternal(tmpDir, '1');
    assert.strictEqual(result.found, true);
    assert.strictEqual(result.phase_name, 'Foundation');
    assert.strictEqual(result.goal, null);
  });

  test('returns null when roadmap missing', () => {
    const result = getRoadmapPhaseInternal(tmpDir, '1');
    assert.strictEqual(result, null);
  });

  test('returns null when phase not in roadmap', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '### Phase 1: Foundation\n**Goal**: Build the base\n'
    );
    const result = getRoadmapPhaseInternal(tmpDir, '99');
    assert.strictEqual(result, null);
  });

  test('returns null for null phase number', () => {
    const result = getRoadmapPhaseInternal(tmpDir, null);
    assert.strictEqual(result, null);
  });

  test('extracts full section text', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '### Phase 1: Foundation\n**Goal**: Build the base\n**Requirements**: TEST-01\nSome details here\n\n### Phase 2: API\n**Goal**: REST\n'
    );
    const result = getRoadmapPhaseInternal(tmpDir, '1');
    assert.ok(result.section.includes('Phase 1: Foundation'));
    assert.ok(result.section.includes('Some details here'));
    // Should not include Phase 2 content
    assert.ok(!result.section.includes('Phase 2: API'));
  });
});

// ─── getMilestonePhaseFilter ────────────────────────────────────────────────────

describe('getMilestonePhaseFilter', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-core-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('filters directories to only current milestone phases', () => {
    // ROADMAP lists only phases 5-7
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      [
        '## Roadmap v2.0: Next Release',
        '',
        '### Phase 5: Auth',
        '**Goal:** Add authentication',
        '',
        '### Phase 6: Dashboard',
        '**Goal:** Build dashboard',
        '',
        '### Phase 7: Polish',
        '**Goal:** Final polish',
      ].join('\n')
    );

    // Create phase dirs 1-7 on disk (leftover from previous milestones)
    for (let i = 1; i <= 7; i++) {
      const padded = String(i).padStart(2, '0');
      fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', `${padded}-phase-${i}`));
    }

    const filter = getMilestonePhaseFilter(tmpDir);

    // Only phases 5, 6, 7 should match
    assert.strictEqual(filter('05-auth'), true);
    assert.strictEqual(filter('06-dashboard'), true);
    assert.strictEqual(filter('07-polish'), true);

    // Phases 1-4 should NOT match
    assert.strictEqual(filter('01-phase-1'), false);
    assert.strictEqual(filter('02-phase-2'), false);
    assert.strictEqual(filter('03-phase-3'), false);
    assert.strictEqual(filter('04-phase-4'), false);
  });

  test('returns pass-all filter when ROADMAP.md is missing', () => {
    const filter = getMilestonePhaseFilter(tmpDir);

    assert.strictEqual(filter('01-foundation'), true);
    assert.strictEqual(filter('99-anything'), true);
  });

  test('returns pass-all filter when ROADMAP has no phase headings', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Roadmap\n\nSome content without phases.\n'
    );

    const filter = getMilestonePhaseFilter(tmpDir);

    assert.strictEqual(filter('01-foundation'), true);
    assert.strictEqual(filter('05-api'), true);
  });

  test('handles letter-suffix phases (e.g. 3A)', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '### Phase 3A: Sub-feature\n**Goal:** Sub work\n'
    );

    const filter = getMilestonePhaseFilter(tmpDir);

    assert.strictEqual(filter('03A-sub-feature'), true);
    assert.strictEqual(filter('03-main'), false);
    assert.strictEqual(filter('04-other'), false);
  });

  test('handles decimal phases (e.g. 5.1)', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '### Phase 5: Main\n**Goal:** Main work\n\n### Phase 5.1: Patch\n**Goal:** Patch work\n'
    );

    const filter = getMilestonePhaseFilter(tmpDir);

    assert.strictEqual(filter('05-main'), true);
    assert.strictEqual(filter('05.1-patch'), true);
    assert.strictEqual(filter('04-other'), false);
  });

  test('returns false for non-phase directory names', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '### Phase 1: Init\n**Goal:** Start\n'
    );

    const filter = getMilestonePhaseFilter(tmpDir);

    assert.strictEqual(filter('not-a-phase'), false);
    assert.strictEqual(filter('.gitkeep'), false);
  });

  test('phaseCount reflects ROADMAP phase count', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '### Phase 5: Auth\n### Phase 6: Dashboard\n### Phase 7: Polish\n'
    );

    const filter = getMilestonePhaseFilter(tmpDir);
    assert.strictEqual(filter.phaseCount, 3);
  });

  test('phaseCount is 0 when ROADMAP is missing', () => {
    const filter = getMilestonePhaseFilter(tmpDir);
    assert.strictEqual(filter.phaseCount, 0);
  });

  test('phaseCount is 0 when ROADMAP has no phase headings', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Roadmap\n\nSome content.\n'
    );

    const filter = getMilestonePhaseFilter(tmpDir);
    assert.strictEqual(filter.phaseCount, 0);
  });
});

// ─── planningRoot ──────────────────────────────────────────────────────────────

describe('planningRoot', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-core-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // Case 1: No .active file, no slug argument
  test('returns .planning when no .active file exists (backward-compatible fallback)', () => {
    const result = planningRoot(tmpDir);
    assert.strictEqual(result, path.join(tmpDir, '.planning'));
  });

  // Case 2: .active file contains a slug, no slug argument
  test('returns .planning/<slug> when .active contains a slug', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', '.active'), 'my-project');
    const result = planningRoot(tmpDir);
    assert.strictEqual(result, path.join(tmpDir, '.planning', 'my-project'));
  });

  // Case 3: Explicit slug override (ignores .active)
  test('returns .planning/override when explicit slug is provided, ignoring .active', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', '.active'), 'file-slug');
    const result = planningRoot(tmpDir, 'override');
    assert.strictEqual(result, path.join(tmpDir, '.planning', 'override'));
  });

  // Case 4: .active file is empty string
  test('falls back to .planning when .active file is empty', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', '.active'), '');
    const result = planningRoot(tmpDir);
    assert.strictEqual(result, path.join(tmpDir, '.planning'));
  });

  // Case 5: .active file has whitespace/newlines
  test('trims whitespace from .active file content', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', '.active'), '  my-project\n');
    const result = planningRoot(tmpDir);
    assert.strictEqual(result, path.join(tmpDir, '.planning', 'my-project'));
  });

  // Case 6: .planning directory doesn't exist at all
  test('returns .planning path even when .planning directory does not exist', () => {
    const nonExistentSubdir = path.join(tmpDir, 'no-such-dir');
    const result = planningRoot(nonExistentSubdir);
    assert.strictEqual(result, path.join(nonExistentSubdir, '.planning'));
  });

  // Case 7: Pure path resolver — does NOT check if returned directory exists
  test('returns path for nonexistent slug without throwing', () => {
    const result = planningRoot(tmpDir, 'nonexistent-slug');
    assert.strictEqual(result, path.join(tmpDir, '.planning', 'nonexistent-slug'));
  });

  test('never throws — always returns a string', () => {
    assert.doesNotThrow(() => planningRoot(tmpDir));
    assert.doesNotThrow(() => planningRoot(tmpDir, 'some-slug'));
    assert.doesNotThrow(() => planningRoot('/totally/nonexistent/path'));
    assert.strictEqual(typeof planningRoot(tmpDir), 'string');
  });
});

// ─── namespace-aware helpers ───────────────────────────────────────────────────

describe('namespace-aware helpers', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-core-ns-test-'));
    // Create .planning/.active pointing to 'my-project'
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', '.active'), 'my-project', 'utf-8');

    // Create namespaced directory structure
    fs.mkdirSync(path.join(tmpDir, '.planning', 'my-project', 'phases', '02-test-phase'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'my-project', 'milestones', 'v1.0-phases', '01-old-phase'), { recursive: true });

    // Create namespaced ROADMAP.md
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'my-project', 'ROADMAP.md'),
      '## Roadmap v2.0: Namespaced Release\n\n### Phase 2: Test Phase\n**Goal:** Test namespace\n'
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('findPhaseInternal finds phase under namespaced phases directory', () => {
    const result = findPhaseInternal(tmpDir, '02');
    assert.ok(result !== null, 'Should find phase');
    assert.strictEqual(result.found, true);
    assert.ok(
      result.directory.startsWith('.planning/my-project/phases/'),
      `Expected directory to start with .planning/my-project/phases/, got: ${result.directory}`
    );
  });

  test('findPhaseInternal searches namespaced milestones directory', () => {
    const result = findPhaseInternal(tmpDir, '01');
    assert.ok(result !== null, 'Should find archived phase');
    assert.strictEqual(result.found, true);
    assert.ok(
      result.directory.includes('my-project/milestones/'),
      `Expected directory to include my-project/milestones/, got: ${result.directory}`
    );
  });

  test('getArchivedPhaseDirs searches namespaced milestones directory', () => {
    const results = getArchivedPhaseDirs(tmpDir);
    assert.ok(results.length > 0, 'Should find archived phase dirs');
    const firstResult = results[0];
    assert.ok(
      firstResult.basePath.includes('my-project/milestones/'),
      `Expected basePath to include my-project/milestones/, got: ${firstResult.basePath}`
    );
  });

  test('getRoadmapPhaseInternal reads ROADMAP.md from namespaced path', () => {
    const result = getRoadmapPhaseInternal(tmpDir, '2');
    assert.ok(result !== null, 'Should find roadmap phase');
    assert.strictEqual(result.found, true);
    assert.strictEqual(result.phase_name, 'Test Phase');
  });

  test('getMilestoneInfo reads ROADMAP.md from namespaced path', () => {
    const info = getMilestoneInfo(tmpDir);
    assert.strictEqual(info.version, 'v2.0');
    assert.strictEqual(info.name, 'Namespaced Release');
  });

  test('getMilestonePhaseFilter reads ROADMAP.md from namespaced path', () => {
    const filter = getMilestonePhaseFilter(tmpDir);
    assert.strictEqual(filter.phaseCount, 1, 'Should count 1 phase from namespaced ROADMAP');
    assert.strictEqual(filter('02-test-phase'), true);
    assert.strictEqual(filter('01-other'), false);
  });

  test('findPhaseInternal still works flat (no .active) — backward compat', () => {
    // Create a separate flat tmpDir without .active
    const flatDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-core-flat-test-'));
    try {
      fs.mkdirSync(path.join(flatDir, '.planning', 'phases', '03-flat-phase'), { recursive: true });
      const result = findPhaseInternal(flatDir, '03');
      assert.ok(result !== null, 'Should find phase in flat layout');
      assert.strictEqual(result.found, true);
      assert.ok(
        result.directory.startsWith('.planning/phases/'),
        `Expected flat directory starting with .planning/phases/, got: ${result.directory}`
      );
    } finally {
      fs.rmSync(flatDir, { recursive: true, force: true });
    }
  });

  test('getMilestoneInfo returns defaults when namespaced ROADMAP is missing', () => {
    // Remove the namespaced ROADMAP to test fallback
    fs.rmSync(path.join(tmpDir, '.planning', 'my-project', 'ROADMAP.md'));
    const info = getMilestoneInfo(tmpDir);
    assert.strictEqual(info.version, 'v1.0');
    assert.strictEqual(info.name, 'milestone');
  });
});

// ─── writeActiveFile ───────────────────────────────────────────────────────────

describe('writeActiveFile', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-core-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // Case 8: Creates .planning/.active with slug content
  test('creates .planning/.active with slug content', () => {
    writeActiveFile(tmpDir, 'new-project');
    const content = fs.readFileSync(path.join(tmpDir, '.planning', '.active'), 'utf-8');
    assert.strictEqual(content, 'new-project');
  });

  // Case 9: Creates .planning/ directory if it doesn't exist
  test('creates .planning/ directory if it does not exist', () => {
    const tmpDirWithoutPlanning = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-core-test-noplanning-'));
    try {
      writeActiveFile(tmpDirWithoutPlanning, 'new-project');
      const content = fs.readFileSync(path.join(tmpDirWithoutPlanning, '.planning', '.active'), 'utf-8');
      assert.strictEqual(content, 'new-project');
    } finally {
      fs.rmSync(tmpDirWithoutPlanning, { recursive: true, force: true });
    }
  });

  // Case 10: Overwrites existing .active file
  test('overwrites existing .active file', () => {
    writeActiveFile(tmpDir, 'first');
    writeActiveFile(tmpDir, 'second');
    const content = fs.readFileSync(path.join(tmpDir, '.planning', '.active'), 'utf-8');
    assert.strictEqual(content, 'second');
  });
});

// ─── listNamespaces ─────────────────────────────────────────────────────────

describe('listNamespaces', () => {
  let tmpDir;

  afterEach(() => {
    if (tmpDir) cleanup(tmpDir);
  });

  test('returns empty array when .planning/ does not exist', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-core-test-'));
    const result = listNamespaces(tmpDir);
    assert.deepStrictEqual(result, []);
  });

  test('returns empty array when .planning/ has no subdirs with PROJECT.md', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-core-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    // Create a subdir without PROJECT.md
    fs.mkdirSync(path.join(tmpDir, '.planning', 'some-dir'));
    const result = listNamespaces(tmpDir);
    assert.deepStrictEqual(result, []);
  });

  test('returns [{slug, name}] for each subdir containing PROJECT.md', () => {
    tmpDir = createTempMultiProject(2);
    const result = listNamespaces(tmpDir);
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].slug, 'project-1');
    assert.strictEqual(result[0].name, 'Project 1');
    assert.strictEqual(result[1].slug, 'project-2');
    assert.strictEqual(result[1].name, 'Project 2');
  });

  test('skips dot-directories', () => {
    tmpDir = createTempMultiProject(1);
    // Create dot-dirs that should be ignored
    fs.mkdirSync(path.join(tmpDir, '.planning', '.active-dir'));
    fs.writeFileSync(path.join(tmpDir, '.planning', '.active-dir', 'PROJECT.md'), '# Dot Dir');
    const result = listNamespaces(tmpDir);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].slug, 'project-1');
  });

  test('skips directories without PROJECT.md', () => {
    tmpDir = createTempMultiProject(1);
    // Add a dir without PROJECT.md
    fs.mkdirSync(path.join(tmpDir, '.planning', 'partial-dir'));
    const result = listNamespaces(tmpDir);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].slug, 'project-1');
  });

  test('parses H1 from PROJECT.md for name, falls back to slug', () => {
    tmpDir = createTempMultiProject(1);
    // Create a project with no H1 in PROJECT.md
    fs.mkdirSync(path.join(tmpDir, '.planning', 'no-heading'));
    fs.writeFileSync(path.join(tmpDir, '.planning', 'no-heading', 'PROJECT.md'), 'Just some text\n');
    const result = listNamespaces(tmpDir);
    const noHeading = result.find(ns => ns.slug === 'no-heading');
    assert.ok(noHeading);
    assert.strictEqual(noHeading.name, 'no-heading'); // falls back to slug
  });

  test('sorts alphabetically by slug', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-core-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    // Create in reverse order
    for (const name of ['zeta', 'alpha', 'mid']) {
      const dir = path.join(tmpDir, '.planning', name);
      fs.mkdirSync(dir);
      fs.writeFileSync(path.join(dir, 'PROJECT.md'), `# ${name}\n`);
    }
    const result = listNamespaces(tmpDir);
    assert.deepStrictEqual(result.map(ns => ns.slug), ['alpha', 'mid', 'zeta']);
  });
});

// ─── detectNeedsSelection ───────────────────────────────────────────────────

describe('detectNeedsSelection', () => {
  let tmpDir;

  afterEach(() => {
    if (tmpDir) cleanup(tmpDir);
  });

  test('returns {needs_selection: false} when no .planning/ exists', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-core-test-'));
    const result = detectNeedsSelection(tmpDir);
    assert.strictEqual(result.needs_selection, false);
  });

  test('returns {needs_selection: false} when .active points to valid namespace', () => {
    tmpDir = createTempMultiProject(2);
    fs.writeFileSync(path.join(tmpDir, '.planning', '.active'), 'project-1');
    const result = detectNeedsSelection(tmpDir);
    assert.strictEqual(result.needs_selection, false);
  });

  test('returns {needs_selection: true, reason: stale_active} when .active points to non-existent dir', () => {
    tmpDir = createTempMultiProject(2);
    fs.writeFileSync(path.join(tmpDir, '.planning', '.active'), 'deleted-project');
    const result = detectNeedsSelection(tmpDir);
    assert.strictEqual(result.needs_selection, true);
    assert.strictEqual(result.reason, 'stale_active');
    assert.strictEqual(result.stale_slug, 'deleted-project');
    assert.ok(Array.isArray(result.available_projects));
    assert.strictEqual(result.available_projects.length, 2);
  });

  test('returns {needs_selection: false} when 0 namespaces exist (no .active)', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-core-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    const result = detectNeedsSelection(tmpDir);
    assert.strictEqual(result.needs_selection, false);
  });

  test('auto-writes .active and returns {needs_selection: false} when exactly 1 namespace exists (no .active)', () => {
    tmpDir = createTempMultiProject(1);
    // No .active file
    const result = detectNeedsSelection(tmpDir);
    assert.strictEqual(result.needs_selection, false);
    // Check .active was written
    const active = fs.readFileSync(path.join(tmpDir, '.planning', '.active'), 'utf-8');
    assert.strictEqual(active, 'project-1');
  });

  test('returns {needs_selection: true, reason: no_active} when 2+ namespaces exist (no .active)', () => {
    tmpDir = createTempMultiProject(2);
    // No .active file
    const result = detectNeedsSelection(tmpDir);
    assert.strictEqual(result.needs_selection, true);
    assert.strictEqual(result.reason, 'no_active');
    assert.ok(Array.isArray(result.available_projects));
    assert.strictEqual(result.available_projects.length, 2);
  });
});

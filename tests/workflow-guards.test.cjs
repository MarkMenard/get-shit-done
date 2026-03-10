/**
 * GSD Tools Tests - Workflow Guards
 *
 * E2E tests verifying init JSON shapes for needs_migration and needs_selection
 * responses across all init types. These tests verify the data contract between
 * init functions and the shared namespace guard template.
 *
 * Covers requirements: INT-01, FLOW-01, FLOW-02
 */

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempGitProject, createTempMultiProject, cleanup } = require('./helpers.cjs');

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Creates a flat layout project with git init and a phase directory.
 * createTempGitProject already creates .planning/PROJECT.md (flat layout)
 * which triggers needs_migration. We add a phase dir for init types that need one.
 */
function createFlatWithPhase() {
  const tmpDir = createTempGitProject();
  // Add phase directory for init types that require one
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-setup'), { recursive: true });
  return tmpDir;
}

/**
 * Assert needs_migration JSON shape on parsed init output.
 */
function assertNeedsMigrationShape(output) {
  assert.strictEqual(output.needs_migration, true, 'needs_migration should be true');
  assert.ok(
    typeof output.suggested_slug === 'string' || output.suggested_slug === null,
    'suggested_slug should be string or null'
  );
  assert.ok(Array.isArray(output.detected_files), 'detected_files should be an array');
  assert.strictEqual(output.planning_root, undefined, 'planning_root should be absent');
}

/**
 * Assert needs_selection (no_active) JSON shape.
 */
function assertNeedsSelectionNoActive(output) {
  assert.strictEqual(output.needs_selection, true, 'needs_selection should be true');
  assert.strictEqual(output.reason, 'no_active', 'reason should be no_active');
  assert.ok(Array.isArray(output.available_projects), 'available_projects should be an array');
  assert.ok(output.available_projects.length >= 2, 'should have at least 2 projects');
  for (const proj of output.available_projects) {
    assert.ok(typeof proj.slug === 'string', 'each project should have slug');
    assert.ok(typeof proj.name === 'string', 'each project should have name');
  }
}

/**
 * Assert needs_selection (stale_active) JSON shape.
 */
function assertNeedsSelectionStale(output) {
  assert.strictEqual(output.needs_selection, true, 'needs_selection should be true');
  assert.strictEqual(output.reason, 'stale_active', 'reason should be stale_active');
  assert.ok(typeof output.stale_slug === 'string', 'stale_slug should be a string');
  assert.ok(Array.isArray(output.available_projects), 'available_projects should be an array');
}

// ─── Scenario 1: needs_migration (flat layout) ─────────────────────────────

describe('needs_migration JSON shape (flat layout)', () => {
  let tmpDir;

  afterEach(() => {
    if (tmpDir) cleanup(tmpDir);
    tmpDir = null;
  });

  test('init execute-phase returns needs_migration for flat layout', () => {
    tmpDir = createFlatWithPhase();
    const result = runGsdTools('init execute-phase 01', tmpDir);
    assert.ok(result.success, `should succeed: ${result.error}`);
    const output = JSON.parse(result.output);
    assertNeedsMigrationShape(output);
  });

  test('init plan-phase returns needs_migration for flat layout', () => {
    tmpDir = createFlatWithPhase();
    const result = runGsdTools('init plan-phase 01', tmpDir);
    assert.ok(result.success, `should succeed: ${result.error}`);
    const output = JSON.parse(result.output);
    assertNeedsMigrationShape(output);
  });

  test('init phase-op returns needs_migration for flat layout', () => {
    tmpDir = createFlatWithPhase();
    const result = runGsdTools('init phase-op 01', tmpDir);
    assert.ok(result.success, `should succeed: ${result.error}`);
    const output = JSON.parse(result.output);
    assertNeedsMigrationShape(output);
  });

  test('init milestone-op returns needs_migration for flat layout', () => {
    tmpDir = createFlatWithPhase();
    const result = runGsdTools('init milestone-op', tmpDir);
    assert.ok(result.success, `should succeed: ${result.error}`);
    const output = JSON.parse(result.output);
    assertNeedsMigrationShape(output);
  });

  test('init quick returns needs_migration for flat layout', () => {
    tmpDir = createFlatWithPhase();
    const result = runGsdTools('init quick test', tmpDir);
    assert.ok(result.success, `should succeed: ${result.error}`);
    const output = JSON.parse(result.output);
    assertNeedsMigrationShape(output);
  });
});

// ─── Scenario 2: needs_selection (no_active) ───────────────────────────────

describe('needs_selection no_active JSON shape (multi-project)', () => {
  let tmpDir;

  afterEach(() => {
    if (tmpDir) cleanup(tmpDir);
    tmpDir = null;
  });

  test('init execute-phase returns needs_selection no_active', () => {
    tmpDir = createTempMultiProject(2);
    // Add a phase dir under project-1 for init types that need it
    fs.mkdirSync(path.join(tmpDir, '.planning', 'project-1', 'phases', '01-setup'), { recursive: true });
    const result = runGsdTools('init execute-phase 01', tmpDir);
    assert.ok(result.success, `should succeed: ${result.error}`);
    const output = JSON.parse(result.output);
    assertNeedsSelectionNoActive(output);
  });
});

// ─── Scenario 3: needs_selection (stale_active) ────────────────────────────

describe('needs_selection stale_active JSON shape (multi-project)', () => {
  let tmpDir;

  afterEach(() => {
    if (tmpDir) cleanup(tmpDir);
    tmpDir = null;
  });

  test('init execute-phase returns needs_selection stale_active', () => {
    tmpDir = createTempMultiProject(2);
    // Write .active pointing to nonexistent project
    fs.writeFileSync(path.join(tmpDir, '.planning', '.active'), 'nonexistent-project');
    const result = runGsdTools('init execute-phase 01', tmpDir);
    assert.ok(result.success, `should succeed: ${result.error}`);
    const output = JSON.parse(result.output);
    assertNeedsSelectionStale(output);
  });
});

// ─── Scenario 4: new-project exclusion ──────────────────────────────────────

describe('new-project exclusion from migration detection', () => {
  let tmpDir;

  afterEach(() => {
    if (tmpDir) cleanup(tmpDir);
    tmpDir = null;
  });

  test('init new-project does NOT return needs_migration on flat layout', () => {
    tmpDir = createFlatWithPhase();
    const result = runGsdTools('init new-project', tmpDir);
    assert.ok(result.success, `should succeed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.notStrictEqual(output.needs_migration, true, 'new-project should not trigger needs_migration');
  });
});

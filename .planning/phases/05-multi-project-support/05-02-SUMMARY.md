---
phase: 05-multi-project-support
plan: 02
subsystem: init, workflow
tags: [namespace, selection-interception, init, workflow, cjs]

# Dependency graph
requires:
  - phase: 05-multi-project-support
    plan: 01
    provides: detectNeedsSelection, listNamespaces, createTempMultiProject
provides:
  - Selection interception in all 11 init functions (except cmdInitNewProject)
  - existing_projects and existing_count in cmdInitNewProject output
  - /gsd:switch-project workflow for project switching
affects: [workflows, commands]

# Tech tracking
tech-stack:
  added: []
  patterns: [selection-guard-pattern, init-interception]

key-files:
  created:
    - commands/gsd/switch-project.md
  modified:
    - get-shit-done/bin/lib/init.cjs
    - tests/init.test.cjs

decisions:
  - Selection check placed after migration check in all init functions (migration > selection ordering)
  - cmdInitNewProject excluded from selection detection per user decision
  - Namespace-aware tests updated to include PROJECT.md for valid namespace validation

metrics:
  duration: 6min
  completed: "2026-03-09T03:50:00Z"
---

# Phase 05 Plan 02: Init Selection Interception + Switch Workflow Summary

Selection guards wired into all 11 init functions so multi-namespace repos trigger project selection; cmdInitNewProject returns existing project info without blocking; switch-project workflow added for discoverability.

## What Was Done

### Task 1: Wire detectNeedsSelection into init functions + update cmdInitNewProject (TDD)

**RED:** Added 6 integration tests in `tests/init.test.cjs` under `describe('init selection interception')`:
- cmdInitExecutePhase, cmdInitPlanPhase, cmdInitProgress return `needs_selection:true` on multi-project with no `.active`
- cmdInitNewProject does NOT return `needs_selection` (excluded by design)
- cmdInitNewProject returns `existing_projects` array and `existing_count`
- Valid `.active` proceeds normally without selection interruption

**GREEN:**
- Added `detectNeedsSelection` and `listNamespaces` to `require('./core.cjs')` destructure in init.cjs
- Added selection check (`const selection = detectNeedsSelection(cwd)`) after migration check in all 11 functions: cmdInitExecutePhase, cmdInitPlanPhase, cmdInitNewMilestone, cmdInitQuick, cmdInitResume, cmdInitVerifyWork, cmdInitPhaseOp, cmdInitTodos, cmdInitMilestoneOp, cmdInitMapCodebase, cmdInitProgress
- Added `existing_projects` and `existing_count` to cmdInitNewProject result via `listNamespaces(cwd)`

**Commits:** `628df10` (RED), `42d8832` (GREEN)

### Task 2: Create /gsd:switch-project workflow

Created `commands/gsd/switch-project.md` following established command file patterns:
- Runs `list-projects` to get current projects
- Handles edge cases: 0 projects (suggests new-project), 1 project (already active)
- For 2+ projects: presents list with active marker, prompts user selection
- Applies selection via `active-set` command

**Commit:** `0ca5c61`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed namespace-aware test setup missing PROJECT.md**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** Pre-existing `namespace-aware init` tests created namespace directories without `PROJECT.md`, causing `detectNeedsSelection` to treat the `.active` slug as stale
- **Fix:** Added `fs.writeFileSync(path.join(tmpDir, '.planning', 'my-project', 'PROJECT.md'), ...)` to `beforeEach` setup
- **Files modified:** tests/init.test.cjs
- **Commit:** 42d8832

## Verification

- All 6 new selection interception tests pass
- Namespace-aware init tests pass (fixed by adding PROJECT.md)
- Full suite: 625 pass, 12 fail (all pre-existing failures unrelated to this plan)
- `commands/gsd/switch-project.md` exists with `list-projects` and `active-set` references

---
phase: 07-workflow-init-response-handling
plan: 01
subsystem: workflow
tags: [namespace, guard, migration, selection, init, template]

requires:
  - phase: 04-migration-system
    provides: detectFlatLayout and cmdMigrate for migration detection and execution
  - phase: 05-multi-project
    provides: detectNeedsSelection and cmdActiveSet for project selection
provides:
  - Shared namespace guard template for all workflows
  - E2E tests verifying init JSON shape contracts for migration and selection
affects: [07-02 workflow integration, agent prompts]

tech-stack:
  added: []
  patterns: [shared guard template referenced by all workflows, JSON shape contract testing]

key-files:
  created:
    - get-shit-done/templates/init-guard.md
    - tests/workflow-guards.test.cjs
  modified: []

key-decisions:
  - "Guard template uses 're-run the same init command' pattern rather than hardcoding init subcommands"
  - "Tests organized by scenario (migration, selection, exclusion) not by init type"
  - "assertNeedsMigrationShape helper validates shape consistently across all 5 init types"

patterns-established:
  - "Namespace guard: shared markdown instruction file that Claude follows after every init call"
  - "JSON shape contract tests: verify exact field names, types, and companion fields between producer and consumer"

requirements-completed: [INT-01, FLOW-01, FLOW-02]

duration: 2min
completed: 2026-03-10
---

# Phase 7 Plan 1: Guard Template and JSON Shape Tests Summary

**Shared namespace guard template and E2E tests verifying init JSON contracts for needs_migration and needs_selection responses**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-10T03:06:38Z
- **Completed:** 2026-03-10T03:08:44Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created shared guard template covering migration flow (AskUserQuestion, migrate command, re-init), selection flow (stale_active warning, project picker, active-set, re-init), and no-op case
- Created 8 E2E tests verifying JSON shape contracts across 5 init types for needs_migration, needs_selection (no_active and stale_active), and new-project exclusion
- Full test suite passes (649 tests, 0 failures)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create E2E tests for init JSON shapes** - `9ab298a` (test)
2. **Task 2: Create shared namespace guard template** - `4b4b1e8` (feat)

## Files Created/Modified
- `tests/workflow-guards.test.cjs` - E2E tests for init JSON shape contracts across migration/selection scenarios
- `get-shit-done/templates/init-guard.md` - Shared namespace guard template for all workflows

## Decisions Made
- Guard template instructs Claude to "re-run the same init command shown above" rather than hardcoding specific init subcommands, making it work generically across all workflow types
- Tests organized by scenario (needs_migration, needs_selection no_active, needs_selection stale_active, new-project exclusion) with shared assertion helpers
- Selection flow has no skip option (user must pick a project); migration flow allows skip but stops the workflow

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Guard template ready for integration into all ~28 workflows (Plan 02)
- JSON shape contracts verified, providing confidence for workflow integration
- All init types confirmed to return correct shapes for migration/selection states

---
*Phase: 07-workflow-init-response-handling*
*Completed: 2026-03-10*

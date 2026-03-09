---
phase: 05-multi-project-support
plan: 01
subsystem: core
tags: [namespace, multi-project, cli, cjs]

# Dependency graph
requires:
  - phase: 01-core-path-resolution
    provides: planningRoot, writeActiveFile, safeReadFile
provides:
  - listNamespaces function for scanning namespace directories
  - detectNeedsSelection function for namespace selection logic
  - cmdListProjects command for JSON project listing
  - list-projects CLI command via dispatcher
  - createTempMultiProject test helper
affects: [05-02, workflows, init]

# Tech tracking
tech-stack:
  added: []
  patterns: [namespace-directory-scanning, auto-active-selection]

key-files:
  created: []
  modified:
    - get-shit-done/bin/lib/core.cjs
    - get-shit-done/bin/lib/config.cjs
    - get-shit-done/bin/gsd-tools.cjs
    - tests/core.test.cjs
    - tests/config.test.cjs
    - tests/helpers.cjs

key-decisions:
  - "listNamespaces requires PROJECT.md as namespace marker -- dirs without it are ignored"
  - "detectNeedsSelection auto-writes .active silently for single-namespace repos"
  - "cmdListProjects uses listNamespaces from core.cjs, not duplicate logic"

patterns-established:
  - "Namespace detection: dir.isDirectory() + !startsWith('.') + has PROJECT.md"
  - "H1 parsing from PROJECT.md for display name with slug fallback"

requirements-completed: [MULT-01, MULT-03, MULT-04]

# Metrics
duration: 4min
completed: 2026-03-09
---

# Phase 5 Plan 01: Core Multi-Project Functions Summary

**listNamespaces, detectNeedsSelection, and cmdListProjects functions with list-projects CLI command and 19 new tests**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-09T03:38:14Z
- **Completed:** 2026-03-09T03:42:19Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- listNamespaces scans .planning/ for namespace directories containing PROJECT.md, returns sorted [{slug, name}]
- detectNeedsSelection handles all cases: valid .active, stale .active, no .active with 0/1/2+ namespaces
- cmdListProjects returns JSON with projects array, count, and active_slug via CLI
- createTempMultiProject test helper available for Plan 02 and beyond

## Task Commits

Each task was committed atomically:

1. **Task 1: Core functions -- listNamespaces and detectNeedsSelection (TDD)** - `f362259` (feat)
2. **Task 2: cmdListProjects command and CLI dispatcher routing (TDD)** - `596c286` (feat)

_TDD tasks: RED (failing tests) and GREEN (implementation) in single commits each._

## Files Created/Modified
- `get-shit-done/bin/lib/core.cjs` - Added listNamespaces and detectNeedsSelection functions
- `get-shit-done/bin/lib/config.cjs` - Added cmdListProjects command
- `get-shit-done/bin/gsd-tools.cjs` - Added list-projects dispatcher case
- `tests/core.test.cjs` - 13 new tests for listNamespaces and detectNeedsSelection
- `tests/config.test.cjs` - 6 new tests for cmdListProjects and CLI integration
- `tests/helpers.cjs` - Added createTempMultiProject helper

## Decisions Made
- listNamespaces requires PROJECT.md as the namespace marker -- directories without it are ignored
- detectNeedsSelection auto-writes .active silently when exactly 1 namespace exists (convenience behavior)
- cmdListProjects reuses listNamespaces from core.cjs rather than duplicating scanning logic

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- listNamespaces and detectNeedsSelection ready for Plan 02 init interception
- createTempMultiProject helper available for all multi-project test scenarios
- list-projects CLI command available for workflows

---
*Phase: 05-multi-project-support*
*Completed: 2026-03-09*

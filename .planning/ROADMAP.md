# Roadmap: GSD Project Namespacing

## Overview

Transform GSD from a flat `.planning/` layout to namespace-aware `.planning/<slug>/` structure. The refactor builds outward from a central `planningRoot` function: first the core resolution infrastructure, then propagation through tools and workflows, then migration for existing users, multi-project coexistence, and finally end-to-end validation including self-hosting.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Core Path Resolution** - Central planningRoot function, config loading, and slug storage (completed 2026-03-04)
- [ ] **Phase 2: Init and Tool Integration** - All init functions and gsd-tools commands resolve paths through planningRoot
- [ ] **Phase 3: Workflow Updates** - All 33 workflow files and templates use init-provided paths
- [ ] **Phase 4: Migration System** - Detect flat layouts, prompt user, migrate files, validate
- [ ] **Phase 5: Multi-Project Support** - Multiple namespaces coexist with selection and listing
- [ ] **Phase 6: Validation and Self-Hosting** - Test suite passes, end-to-end self-host, migration path verified

## Phase Details

### Phase 1: Core Path Resolution
**Goal**: A single source of truth for planning directory paths exists and is used by config loading
**Depends on**: Nothing (first phase)
**Requirements**: PATH-01, PATH-03, PATH-04
**Success Criteria** (what must be TRUE):
  1. Calling `planningRoot(cwd, slug)` returns the correct `.planning/<slug>/` path for any given slug
  2. `loadConfig()` reads config.json from the namespace-resolved path (not hardcoded `.planning/config.json`)
  3. Project slug is persisted in the namespaced config.json and can be read back by other commands
**Plans**: TBD

Plans:
- [x] 01-01: planningRoot and writeActiveFile functions (TDD) — PATH-01
- [ ] 01-02: Thread planningRoot through config subsystem + active-set CLI — PATH-03, PATH-04

### Phase 2: Init and Tool Integration
**Goal**: Every gsd-tools command that reads or writes planning files resolves paths through planningRoot
**Depends on**: Phase 1
**Requirements**: PATH-02, PATH-05, TOOL-01, TOOL-02, TOOL-03, TOOL-04, TOOL-05
**Success Criteria** (what must be TRUE):
  1. All 12 init functions in init.cjs return paths under `.planning/<slug>/` instead of `.planning/`
  2. Phase operations (add, remove, complete, next-decimal, insert) read/write from the namespaced directory
  3. Roadmap operations (get-phase, analyze, update-plan-progress) read/write from the namespaced directory
  4. Milestone operations archive to/from the namespaced directory
  5. gsd-tools.js main entry routes all path references through resolution (no remaining hardcoded `.planning/` in bin/lib)
**Plans**: 3 plans

Plans:
- [ ] 02-01: core.cjs helpers + init.cjs namespace-awareness (TDD) -- PATH-02, TOOL-01, TOOL-02
- [ ] 02-02: phase.cjs namespace-awareness (TDD) -- TOOL-03
- [ ] 02-03: roadmap.cjs + milestone.cjs + state.cjs + commands.cjs namespace-awareness (TDD) -- PATH-05, TOOL-04, TOOL-05

### Phase 3: Workflow Updates
**Goal**: All workflow files and agent prompt templates consume paths from init output, never hardcoded strings
**Depends on**: Phase 2
**Requirements**: WORK-01, WORK-02, WORK-03, WORK-04
**Success Criteria** (what must be TRUE):
  1. No workflow .md file contains a hardcoded `.planning/` path reference (all use variables from init output)
  2. Agent prompts spawned by workflows receive resolved paths as parameters (not string literals)
  3. Bash commands within workflows use `$path_variable` patterns sourced from init JSON output
  4. Template files use placeholder variables that get resolved at runtime
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD
- [ ] 03-03: TBD

### Phase 4: Migration System
**Goal**: Users with existing flat `.planning/` layouts are detected and migrated cleanly into a namespace
**Depends on**: Phase 2
**Requirements**: MIGR-01, MIGR-02, MIGR-03, MIGR-04
**Success Criteria** (what must be TRUE):
  1. Running any gsd-tools command on a flat `.planning/` layout triggers detection (files at root, no slug subdirectory)
  2. User is prompted with a project name and offered migration (not silent, not forced)
  3. After accepting migration, all planning files exist under `.planning/<slug>/` with structure preserved
  4. Post-migration, all gsd-tools commands work against the migrated namespace without manual fixes
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

### Phase 5: Multi-Project Support
**Goal**: Multiple project namespaces coexist under `.planning/` with clear selection and listing
**Depends on**: Phase 2
**Requirements**: MULT-01, MULT-02, MULT-03, MULT-04
**Success Criteria** (what must be TRUE):
  1. Two or more project namespaces can exist under `.planning/` without interfering with each other
  2. `gsd-tools init` correctly identifies which project to operate on (via slug in config or user selection)
  3. When no project is selected or the slug is ambiguous, a clear error message tells the user what to do
  4. User can list all project namespaces under `.planning/` and see their names
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD

### Phase 6: Validation and Self-Hosting
**Goal**: The entire namespaced system is proven to work end-to-end, including migration and self-hosting
**Depends on**: Phase 3, Phase 4, Phase 5
**Requirements**: VALD-01, VALD-02, VALD-03
**Success Criteria** (what must be TRUE):
  1. Existing test suite passes with namespaced paths (no regressions)
  2. A fresh `gsd:new-project` initializes into `.planning/<slug>/`, plans phases, and executes plans successfully
  3. A flat `.planning/` layout is detected, migrated, and all workflows function correctly post-migration
**Plans**: TBD

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6
(Phases 3, 4, 5 depend on Phase 2 but are independent of each other)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Path Resolution | 2/2 | Complete   | 2026-03-04 |
| 2. Init and Tool Integration | 1/3 | In Progress|  |
| 3. Workflow Updates | 0/3 | Not started | - |
| 4. Migration System | 0/2 | Not started | - |
| 5. Multi-Project Support | 0/2 | Not started | - |
| 6. Validation and Self-Hosting | 0/2 | Not started | - |

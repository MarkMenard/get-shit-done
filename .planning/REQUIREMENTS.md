# Requirements: GSD Project Namespacing

**Defined:** 2026-03-04
**Core Value:** Every GSD workflow operates on the correct project's planning state, regardless of branch history or repo context.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Path Resolution

- [x] **PATH-01**: `planningRoot(cwd, slug)` function exists in core.cjs and returns `.planning/<slug>/`
- [x] **PATH-02**: All init commands (12 functions in init.cjs) return paths resolved through `planningRoot`
- [x] **PATH-03**: `loadConfig()` resolves config.json through project slug
- [x] **PATH-04**: Project slug is stored and retrievable from `.planning/<slug>/config.json`
- [x] **PATH-05**: All gsd-tools commands that read/write planning files resolve through `planningRoot`

### Migration

- [x] **MIGR-01**: System detects flat `.planning/` layout (files at root, no slug subdirectory)
- [x] **MIGR-02**: On detection, user is prompted with project name and migration offer
- [x] **MIGR-03**: Migration moves all planning files into `.planning/<slug>/` preserving structure
- [x] **MIGR-04**: Post-migration validation confirms all files accessible at new paths

### Workflow Updates

- [x] **WORK-01**: All 33 workflow .md files reference init-provided path variables, not hardcoded `.planning/` paths
- [x] **WORK-02**: Agent prompt templates in workflows receive resolved paths as parameters
- [x] **WORK-03**: Bash commands in workflows use path variables from init output
- [x] **WORK-04**: Template files that reference `.planning/` paths use placeholder variables

### Tool Updates

- [x] **TOOL-01**: All bin/lib/*.cjs files (init.cjs, core.cjs, phase.cjs, etc.) use `planningRoot` for path construction
- [x] **TOOL-02**: gsd-tools.js (main entry, 4,781 lines) routes all path references through resolution
- [x] **TOOL-03**: Phase operations (next-decimal, add, insert, remove, complete) use resolved paths
- [x] **TOOL-04**: Roadmap operations (get-phase, analyze, update-plan-progress) use resolved paths
- [x] **TOOL-05**: Milestone operations use resolved paths for archiving

### Multi-Project

- [x] **MULT-01**: Multiple project namespaces can coexist under `.planning/` simultaneously
- [x] **MULT-02**: `gsd-tools init` identifies which project to operate on (from slug in config or user selection)
- [x] **MULT-03**: Clear error message when no project is selected or slug is ambiguous
- [x] **MULT-04**: Project listing: user can see all namespaces under `.planning/`

### Validation

- [ ] **VALD-01**: Existing test suite passes with namespaced paths
- [ ] **VALD-02**: End-to-end self-host: namespaced GSD can initialize, plan, and execute a test project
- [ ] **VALD-03**: Migration path tested: flat layout detected, migrated, and all workflows function post-migration

## v2 Requirements

### Enhanced Project Management

- **PROJ-01**: Branch-aware auto-switching between project namespaces
- **PROJ-02**: Project archiving (move namespace to `.planning/.archive/<slug>/`)
- **PROJ-03**: Project cloning (duplicate a namespace for variant work)
- **PROJ-04**: Cross-project dependency tracking

## Out of Scope

| Feature | Reason |
|---------|--------|
| GUI/TUI for project selection | CLI slug selection is sufficient for v1 |
| Backward-compatible silent fallback | Clean break prevents subtle bugs — migration required |
| Multi-repo federation | One repo, one `.planning/`, multiple namespaces within |
| Auto-derive slug from git remote/branch | Fragile across forks and renames — user-provided is reliable |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PATH-01 | Phase 1 | Complete |
| PATH-02 | Phase 2 | Complete |
| PATH-03 | Phase 1 | Complete |
| PATH-04 | Phase 1 | Complete |
| PATH-05 | Phase 2 | Complete |
| MIGR-01 | Phase 4 | Complete |
| MIGR-02 | Phase 4 | Complete |
| MIGR-03 | Phase 4 | Complete |
| MIGR-04 | Phase 4 | Complete |
| WORK-01 | Phase 3 | Complete |
| WORK-02 | Phase 3 | Complete |
| WORK-03 | Phase 3 | Complete |
| WORK-04 | Phase 3 | Complete |
| TOOL-01 | Phase 2 | Complete |
| TOOL-02 | Phase 2 | Complete |
| TOOL-03 | Phase 2 | Complete |
| TOOL-04 | Phase 2 | Complete |
| TOOL-05 | Phase 2 | Complete |
| MULT-01 | Phase 5 | Complete |
| MULT-02 | Phase 5 | Complete |
| MULT-03 | Phase 5 | Complete |
| MULT-04 | Phase 5 | Complete |
| VALD-01 | Phase 6 | Pending |
| VALD-02 | Phase 6 | Pending |
| VALD-03 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0

---
*Requirements defined: 2026-03-04*
*Last updated: 2026-03-04 after roadmap creation*

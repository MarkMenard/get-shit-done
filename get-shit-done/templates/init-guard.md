# Namespace Guard

After running the init command above, check the INIT JSON for migration or selection states before extracting fields. If neither state is present, skip this section entirely and continue normally.

## Check for needs_migration

If the INIT JSON contains `"needs_migration": true`:

1. Extract `suggested_slug` and `detected_files` from the JSON.
2. Present an AskUserQuestion to the user:
   - Show the detected files: "Found planning files at flat `${planning_root}/` layout: [detected_files list]"
   - Explain: "This project needs to be migrated to a namespaced layout before continuing."
   - Options:
     - **"Migrate now as '[suggested_slug]'"** -- use the suggested slug from init
     - **"Use different name"** -- ask the user for a custom project slug
     - **"Skip"** -- stop the workflow
3. If the user chooses **Skip**: stop the workflow entirely with this message: "Cannot proceed without a namespaced project. Run migration when ready by using `/gsd:new-project`."
4. If the user chooses to migrate (either with suggested slug or custom slug), run:
   ```bash
   node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" migrate "<chosen-slug>"
   ```
5. After migration completes, re-run the **same init command** shown in the bash block above (the one that produced the INIT variable). Include the `@file:` handling:
   ```bash
   if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
   ```
6. Continue with the fresh INIT JSON.

## Check for needs_selection

If the INIT JSON contains `"needs_selection": true`:

1. Check the `reason` field in the JSON.
2. If `reason` is `"stale_active"`: warn the user -- "Project '[stale_slug]' no longer exists. Pick an active project to continue."
3. If `reason` is `"no_active"`: tell the user -- "Multiple projects found. Select one to continue."
4. List the `available_projects` array from the JSON, showing each project's `slug` and `name`.
5. Present an AskUserQuestion for the user to pick a project from the list. Selection is required -- there is no skip option.
6. After the user selects a project, run:
   ```bash
   node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" active-set "<chosen-slug>"
   ```
7. After selection completes, re-run the **same init command** shown in the bash block above (the one that produced the INIT variable). Include the `@file:` handling:
   ```bash
   if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
   ```
8. Continue with the fresh INIT JSON.

## No-op case

If the INIT JSON contains neither `needs_migration` nor `needs_selection`, do nothing -- continue with normal field extraction.

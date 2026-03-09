---
name: gsd:switch-project
description: Switch active project in a multi-project repository
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
---

<objective>
Switch the active project namespace when multiple projects exist under .planning/.

Handles listing available projects, prompting for selection, and updating the active project pointer.
</objective>

<process>

1. **List projects:**
   ```bash
   node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" list-projects
   ```
   Parse the JSON response: `projects` array, `count`, `active_slug`.

2. **Handle edge cases:**
   - If `count === 0`: Tell the user: "No projects found. Use `/gsd:new-project` to create one." Stop.
   - If `count === 1`: Tell the user: "Only one project exists: {name} ({slug}). It is already active." Stop.

3. **Present options (count >= 2):**
   Display the list of projects. Mark the currently active one with `(active)`.

   Ask the user which project they want to switch to. Accept the slug or number from the list.

4. **Apply selection:**
   ```bash
   node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" active-set {selected-slug}
   ```

5. **Confirm:** "Switched to project: {name} ({slug})"

</process>

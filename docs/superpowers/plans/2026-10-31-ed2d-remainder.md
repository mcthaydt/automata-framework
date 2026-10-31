# ED2D remainder and GAME-2D.ED: plan (second wide PR)

Stacked on #353 (field form, ED2D.8 polish and journeys) and #367 (the 3D editor, Studio, `automata editor`): this branch
merges both. Order of work, each a commit, each pushed. Owner 2026-10-31: "make the PRs WIDE"; specs and plans are
auto-accepted.

## Steps (ticked when their checks pass)
- [x] A. ED2D.9, the 2D wiring: `packages/editor-2d/src/main.ts` takes the workspace of the server it came from
  (`openServedWorkspace`), so `automata editor --app 2d` edits the checkout; the command, server, kit HTTP store, guide and
  agent skill are #367's. Checked: build, svelte-check, and a real-browser load of the built editor served by the built CLI
  (Home opens on the served workspace).
- [ ] B. ED2D.7b export dialog and the recovery journeys.
- [ ] C. ED2D.6c reference picker and level links.
- [ ] D. ED2D.10 acceptance G-q to G-t on one build.
- [ ] E. GAME-2D.ED: Emberwick's room and tuning authored in the 2D editor; golden `31f50888ccb4cf0a` unchanged.
- [ ] F. Reconcile the ED2D.8 row: origin/main has ED2D.8a and 8b; #353 has the polish, a11y and journeys.
- [ ] G. gates and the PR.

## Execution log
- 2026-10-31, A: findings. (1) The kit's storage notes still say "browser storage" on Home when the workspace is a served
  checkout (the kit's `storageNotes` does not know the `http` store kind): a small kit change, not done here. (2) The served
  2D editor lists `*.json` files of the checkout when it has no `content/editors.toml`; the level-project file name is
  `*.af2d.json`, so a game's 2D editor row belongs in its editor list.
- Hand-off: B to G are not started. The 2D rows are L-sized each (export dialog, reference picker, acceptance, a game
  authoring session); this lane stopped here with its context nearly spent, branch pushed.

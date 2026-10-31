# ED2D export labels in plain words (APP §5b)

**Row:** coordinator's NEXT item 3 after ED2D.7b (#308), stacked on `claude/ed2d-7b-export` until it merges. Lane
**editors**. Size S. [APP spec](../specs/2026-10-30-paid-editor-apps-design.md) §5b.3: "The editors use plain words
… Never branch, commit, merge or a file path, unless the user opens the details." ADR 0006: targets in general rather
than one host. Accepted under the Owner's "Auto accept all spec and plans".

**Goal:** the Export view's two targets read as what they are to someone who is not a developer: `Working file
(.af2d.json)` becomes **Project file** (the mockup's own word) and `AF content (TOML)` becomes **Game files**. Ids,
files and behaviour do not change. A survey of `packages/editor-*/src` found no host-specific (Ruken) words in editor
UI text, so there is nothing else to change for ADR 0006 here.

## Files

- Modify `packages/editor-2d/src/profiles/level-project/level-project.ts` (the two labels) and its test (a case on
  the labels).
- Modify `packages/editor-2d/src/app/export/ExportView.dom.test.ts` (find the targets by their new names).
- Modify `docs/design/editor-2d/screens-general.mjs` (the Export mockup's "AF content" target, its name and note).

**Interfaces:** none change (`ExportTarget.label` is already free text; ids `af2d-json` and `af-content` stay).

## Steps

- [x] 1. Plan (this file).
- [x] 2. The label case in `level-project.test.ts` and the DOM test's names fail on the old labels; change the labels;
  editor-2d unit+dom pass.
- [x] 3. Mockup words; `node docs/design/editor-2d/build.mjs list` still lists the export screen.
- [x] 4. Gates: `pnpm format`, `TURBO_FORCE=true pnpm check`, editor-2d `test:parity`.

## Execution log

- 2026-10-31: plan written on `claude/ed2d-7b-export` at `a92db28d`.
- 2026-10-31, steps 2 and 3: the label case and the two Export view cases failed on the old labels (3 failed), then
  pass; editor-2d unit+dom 154 files, 2529 tests. The mockup's export screen is now "Export · project file and game
  files" and its second target "Game files"; `build.mjs list` lists it.
- 2026-10-31, step 4: `pnpm format` clean; `TURBO_FORCE=true pnpm check` exit 0 (37/37 and 35/35 tasks, 0 cached);
  editor-2d `test:parity` 24 files, 606 tests. Then merged `origin/main` (`bb0b330c`, docs only).

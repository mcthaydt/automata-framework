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
- [ ] 2. The label case in `level-project.test.ts` and the DOM test's names fail on the old labels; change the labels;
  editor-2d unit+dom pass.
- [ ] 3. Mockup words; `node docs/design/editor-2d/build.mjs list` still lists the export screen.
- [ ] 4. Gates: `pnpm format`, `TURBO_FORCE=true pnpm check`, editor-2d `test:parity`.

## Execution log

- 2026-10-31: plan written on `claude/ed2d-7b-export` at `a92db28d`.

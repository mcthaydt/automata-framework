# Editors follow-ups: Studio protocol, chest-space handles, Studio layout in WebKit and Firefox (plan)

Stacked on #374 (`claude/editors-2d-wide`, which carries the Studio fixes these follow). Coordinator, 2026-11-01: "editors follow-ups": (1) the Studio session follows the shell's apply-then-write protocol, so its Undo label stops reading "Edit" (the #375 deviation); (2) chest-space handle targets, left unconverted by #374; (3) the Studio layout check in WebKit and Firefox as well as Chromium (#374's follow-up). One draft PR. Specs and plans are auto-accepted (Owner, 2026-10-31).

## 1. The Studio session follows the shell's protocol

**Why.** The suite's write path (`core/write-path.ts`) routes every editor write and records the editor's own label for the step it just applied (`editing.label = () => hook.undoLabel() ?? 'Edit'`). The Studio session writes first and applies the history step after, so the label is read before the step exists and the top bar says "Undo Edit". Its undo hook also calls `controller.undo()`, which writes the files back a second time after the shell's own undo write.

**Change.** `studio-session.ts`: `commit(label, next)` applies the step, then writes (`sync(from, next)`); a refused write takes the step back (`history.undo()`) and returns the refusal, so the history is as it was. `studio-suite-editor.ts`: the undo hook's `undo`/`redo` step the history only (the shell writes the files back through its own path, including removing a file the Studio created); `controller.undo()`/`redo()` and `session.undo()`/`redo()` (write-back included) stay for use outside the shell and in the session tests.

**Tests (written first).**
- `studio-session.test.ts`: while the routed write runs, `history.undoLabel` is already the step's label (a ports wrapper records it); a refused write (stale mtime) leaves `canUndo` false and `state` unchanged (already asserted; kept); a created file refused on write is not left in the history.
- `shell/Suite.studio.dom.test.ts` (new, jsdom, the Studio's stand-in stage): in the suite shell, a slider change (keyboard on "Height") asks for the change set's title once, writes one span, the top bar reads "Undo Set height of wick"; Undo from the top bar restores the file text with exactly one write after the edit (the shell's), and Redo re-applies.

## 2. Chest-space handle targets

**Why.** A pose effector may be written `space = "chest"` (its position in the chest joint's frame). #374 draws and drags every handle as if its value were root-space reference metres; a chest-space handle is then drawn and dragged in the wrong place.

**Change.** `studio-view.ts`: `Handle` gains `space` and `root` (the target in root-space reference metres: `apply(chestFrame, pos)` for a chest-space target, the value itself otherwise; `chestFrame` is the figure's standing chest frame in reference units, from `evaluate` with no action, which is the frame the library converts with) and two pure helpers, `rootOfValue(handle, value)` and `valueOfRoot(handle, root)` (the inverse through `invertRigid`). `StudioCanvas.svelte` draws `root x scale` and a drag converts the dragged world point to a root-space reference position and then to the value through `valueOfRoot`; a key press moves in root space the same way. The fields in `PoseFields.svelte` keep showing the pose's own value.

**Tests (written first).** `studio-view.test.ts`: for a live pose with `handR` in chest space, `root x scale` equals the solved hand's world position (within 1 cm) and the same pose written in root space at that `root` draws the same point; `valueOfRoot(rootOfValue(v)) = v` for both spaces; a drag in the canvas DOM test writes the chest-space value (the file keeps `space = "chest"`).

## 3. The Studio layout in WebKit and Firefox

The suite's `layout` project already runs the three engines; #374 ran Chromium only. Run `studio.layout.test.ts` in all three at the eight sizes on the merged tree and fix what fails (a WebKit or Firefox only failure is a product finding, not a rebaseline). Record the first-attempt result in the log.

## Gates

`pnpm exec biome check --write <changed>`; focused: `vitest run --project unit|dom src/editors/studio src/shell/Suite.studio.dom.test.ts`, `--project 'layout*' src/editors/studio` with `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-local`; `TURBO_FORCE=true pnpm check`; `pnpm build`, `api-report`, `api-index`, `agent-skills` (editor-suite is private: no changeset). No sim, renderer, golden or published package touched: no parity. Review images (the Studio at 1194x834 in WebKit and Firefox) under `docs/evidence/owner-visual/2026-11-01-editors-followups/` if the layout run changes anything visible.

## Decisions for the Owner's veto (agent defaults)

- `Handle` gains `space` and `root` (the Studio's own type; private package).
- The shell's Undo, not the editor, writes files back on Undo; the editor's hook only follows.

## Execution log

- 2026-11-01: plan written on `claude/editors-followups` (from `claude/editors-2d-wide`, stacked on #374).
- 2026-11-01, 1: `studio-session.test.ts` (the label at write time; a refused write takes the step back) was seen failing first (label `undefined` at write time); `Suite.studio.dom.test.ts` (the Studio in the shell: the top bar reads "Undo Set height of wick", and the shell's Undo writes the file back once) was seen failing against the old session and hook (no such button), then passing. `commit` now applies then writes; the undo hook only steps the history. One finding: a refused step stays on the redo stack (as the fixture editor's does): a Redo retries the same write; recorded in the test, not changed.
- 2026-11-01, 2: `Handle` gained `space`, `chest` and `root`; `rootOfValue` and `valueOfRoot` convert through the standing chest frame (`chestFrame` of an evaluation with no action at the stage's time; the first try at time 0 was 11 mm off the solved hand and failed the 5 mm check, so it uses the stage's time). The canvas draws `root x scale`, a drag converts the world point back through `valueOfRoot`, a key press moves in the world's axes. `studio-view.test.ts` (3 new: root x scale equals the solved hand within 5 mm, the round trip, a root-space handle unchanged) failed first (no `space`), then passed; `studio-ui.dom.test.ts` keeps `space = "chest"` in the file after an arrow move. Limit: the arrow test cannot tell the chest's up from the world's up at the fixture's small lean (the conversion's unit test does); a lean-heavy pose is the Owner's visual check.
- 2026-11-01, 3: `studio.layout.test.ts` at the eight sizes in Chromium, WebKit and Firefox on this tree, first attempt: 96 passed (3 files), nothing failed in WebKit or Firefox, so nothing to fix and no new baseline; the screenshots are the layout test's own, not committed (no visible change in this PR).


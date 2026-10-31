# ED2D.6b World view: TDD plan

- **Task:** ED2D.6b in [02](../../02-master-delivery-plan.md). [2D editor spec](../specs/2026-10-23-editor-2d-design.md) §5.7 (layouts), §5.8 (`moveLevelInWorld`, `setWorldLayout`, `resizeLevel(anchor)`), §8 (the World row; flow 7: "World view → drag levels; switch layout; the dock cards on the Level view follow"), §12 (44 px targets, finger and Pencil drags), §13 (a level resized smaller than its content), acceptance G-h (the UI half). Mockup `world` in `docs/design/editor-2d/screens-general.mjs`.
- **Lane:** editors. **Depends on:** ED2D.6a (merged, #230: the world and level commands), ED2D.4c3b (merged: Pixi at the repo pin, `createWebGL2Renderer`), ED2D.4c4b (merged: the inspector's field editor, the dock). **Unblocks:** ED2D.6c (the reference picker and links drawn on the map).
- **Status:** Drafted 2026-10-31. Accepted under the Owner's "Auto accept all spec and plans" (2026-10-30) and "everything is auto approved and accepted" (2026-10-31) once reviewed.
- **Progress:** 4 of 8 steps.

## Scope

**In** (`packages/editor-2d/src/`):

- `model/world/level-edits.ts`: `renameLevel(project, id, name)` (6a left level name edits to this slice). Pure, TDD.
- `app/world/world-model.ts` (pure): the world's level rectangles in world pixels (name, size, depth, selected), the camera that fits them in a box, the hit test (the topmost level under a point: higher depth, then later placement), and a drag's new position from the pointer's travel in screen pixels (divided by the camera's scale, rounded to whole pixels; the layout's snapping is the command's).
- `canvas/world-view.ts` and `app/world/WorldCanvas.svelte`: Pixi draws the rectangles (fill, border, the selected one outlined in the accent, the name inside), fitted to the box; "Preview paused" on a lost context and "Preview unavailable" without WebGL2, as the level canvas does. `data-state` for tests.
- `app/world/WorldView.svelte`: the `WorldView` rail destination. Panel: the worlds (when there are several), the layout switch (Free, Grid, Horizontal, Vertical; the kit's `Segmented`), the levels as a list that selects. Canvas: a pointer layer over the world canvas; a drag on a level moves it as one undo step (a `History` transaction), a tap selects. Inspector: the selected level's name, X and Y (number fields; the keyboard and precise way to move), width and height with Resize, depth, and its level fields with the Level tab's field editor. Resize asks first when it would drop cells (`resizeLevelLoss`), listing them per layer.
- `views.ts`: `WorldView` registered.

**Out, with owner:** links between levels drawn on the map and the reference picker (ED2D.6c); adding, removing and duplicating levels from the World view (the commands exist; the Level view's dock and Home cover making levels today; listed as a follow-up); adding or removing worlds; level thumbnails inside the rectangles (a follow-up: `level-thumbnails.ts` exists); pinch zoom and pan on the world map (it is fitted; ED2D.8 polishes touch).

## Interfaces

**Consumed:** `moveLevelInWorld`, `setWorldLayout`, `setLevelDepth`, `resizeLevel`, `resizeLevelLoss`, `setLevelField`, `findLevel`, `findWorld` (`model/world/`); `History.begin` (transactions); `createWebGL2Renderer`, `createColorResolver` (`canvas/`); `EditorShell`, `Segmented`, `Button`, `Dialog`, `Stepper` or number fields from the kit; `FieldEditor` and `commitField` from `app/level/`; `ViewProps`.

**Produced (private package):** `renameLevel`; `worldRects`, `fitWorld`, `levelAt`, `dragPosition` (`world-model.ts`); `createWorldView` (`canvas/world-view.ts`); `WorldCanvas.svelte`, `WorldView.svelte`; `ViewServices.worldCanvas?` (a stand-in for jsdom, as `canvas` is for the level canvas).

## Decisions (defaults, for the Owner's veto)

1. **The map is fitted, not panned.** The world's bounding box (with a margin) fills the canvas; a drag converts screen travel to world pixels by the fitted scale. Pan and pinch wait for ED2D.8.
2. **A linear world reorders as the level is dragged.** In `horizontal` and `vertical` worlds each move of the drag goes through `moveLevelInWorld`, so the level takes its new place in the sequence as its centre passes a neighbour (6a decision 1); the release makes it one step and the dock follows.
3. **Resize is in the World view's inspector with an anchor.** Width and height fields and a 3 × 3 anchor choice (default top-left); Resize applies, and asks first only when cells would be dropped.
4. **Selecting a level in the World view does not change the Level view's level.** The Level view keeps its own; the World view's selection is its own state.

## Steps

Each step: write the test, run it and see it fail for the stated reason, make the minimal change, see it pass.

- [x] **1. This plan.** Committed first.
- [x] **2. `renameLevel`.** `level-edits.test.ts`: renames, trims; an empty name is a `RangeError`; the same name returns the same object; a missing id is a `RangeError`. Fails: not exported.
- [x] **3. The world model.** `world-model.test.ts`: rectangles for the platformer and RPG templates at their placements; `fitWorld` centres the bounding box in the box with a margin; `levelAt` returns the topmost (depth, then order) and `undefined` on empty space; `dragPosition` divides travel by the scale and rounds. Fails: no module.
- [x] **4. The world canvas (Pixi).** `world-view.canvas.test.ts` (Chromium `canvas` project): draws a rectangle per level, the selected outlined (pixels read back at a level's centre and its outline), `destroy` frees the renderer. Fails: no module.
- [ ] **5. The World view: panel and canvas.** `WorldView.dom.test.ts` with a stand-in canvas: the levels listed and selectable; switching to Grid snaps the placements (one undo step); a pointer drag on a level moves it by the travel over the scale as one undo step, a tap only selects; in a horizontal world a drag past a neighbour reorders, and the Level view's dock shows the new order (G-h, flow 7). Fails: the pending view.
- [ ] **6. The World view: inspector.** `WorldView.dom.test.ts`: rename; X and Y move the level (snapped in a grid world); depth; a level field through the field editor, a refused value keeping the old one; Resize larger applies at once; Resize smaller with painted cells outside asks, lists the cells per layer, and Cancel changes nothing while Resize anyway is one undo step (§13). Fails: no inspector.
- [ ] **7. Layout.** `world-view.layout.test.ts` at the eight sizes in Chromium, WebKit and Firefox: the layout switch, the level list rows and the inspector fields at least 44 px, Resize reachable, the page never scrolls; screenshots.
- [ ] **8. Gates and review images.** Review images in `docs/evidence/owner-visual/2026-10-31-ed2d-6b/` with a README.

## Gates

- `pnpm format`; `TURBO_FORCE=true pnpm check`.
- `pnpm --filter @mcthaydt/automata-editor-2d test:parity` (Chromium, WebKit, Firefox) and the `canvas` project for `world-view.canvas.test.ts`.
- No published package changes: no changeset; `pnpm api-report` to confirm.

## Execution log

- 2026-10-31: plan drafted from `main` at `c9952bfd`.
- Step 2: the three new cases failed with "renameLevel is not a function"; with `renameLevel` the `model/world` tests pass 75 of 75. The rename case first failed on its own fixture (the platformer template has one level), fixed with `withNewLevel`.
- Step 3: failed with "Cannot find module './world-model'"; `world-model.ts` (`worldRects`, `fitWorld`, `levelAt`, `toWorld`, `dragPosition`) passes 6 of 6. `toWorld` was added to the produced interface: the view needs it for the hit test.
- Step 4: `world-view.canvas.test.ts` failed to import (no `world-view.ts`); with `createWorldView` (Pixi `Graphics` rectangles with an inner 2 px outline, accent for the selected, names as `Text` at screen size) it passes in Chromium. Plan decision 2 reworded: the drag reorders a sequence live, through `moveLevelInWorld` on each move, rather than reflowing on release.
- Step 5 (first half, headless): the drag logic is `app/world/world-drag.ts` (`createWorldDrag`: press selects the topmost level, moving drags it inside one `History` transaction, release commits "Move level", cancel puts it back, a press that never moves only selects). It failed with "Cannot find module './world-drag'"; it passes 5 of 5 in Node, the sequence reorder included.

# ED2D.8a: the World view's iPad pass (pan and pinch, duplicate and remove)

**Row:** `docs/02-master-delivery-plan.md` ED2D.8 (Pencil and touch polish), split here because the row's journeys
need EDK.6b (the WebKit iPad journey harness), which is not built. This part needs only the kit's merged gesture layer
(EDK.3: `attachGestures`, `Viewport2D`) and lands the World view follow-ups ED2D.6b left for ED2D.8. Stacked on #322
(ED2D.6c), which adds "Add level". Lane **editors**. Size M. Accepted under the Owner's "Auto accept all spec and plans".
**Spec:** [2D editor spec](../specs/2026-10-23-editor-2d-design.md) §8 (the World row, flow 7), §12 (finger: select,
drag, pan, pinch; Pencil precise drags; mouse wheel zoom, middle pan; 44 px targets; the canvas never scrolls the page),
§13. Mockup `world` (zoom chip, "Pencil moves · finger pans", Duplicate and Delete).

**Left for later parts:** level thumbnails inside the map's rectangles (ED2D.8b); the row's journeys, Pencil hover
footprint, short-height and accessibility passes once EDK.6b lands.

## Decisions (veto-defaults)

1. **The map gets the Level view's gesture mapping** (`level-gestures.ts`): a tap selects the level under it (empty
   space clears); a drag that starts on a level moves it (one undo step, as ED2D.6b's drag); a drag on empty space, the
   middle button, two fingers and the wheel pan; a pinch and Ctrl/Meta+wheel zoom about the pointer; a two-finger tap
   undoes and three fingers redo. Once the Pencil has touched the map a finger only navigates, so a resting hand never
   moves a level.
2. **The camera is a kit `Viewport2D`** (`world-camera.ts`): every measure fits the levels inside 24 px until the
   person pans or zooms, after which a new box keeps the centre, and "Fit" (a 44 px button over the map) fits again. Zoom is 1/32 to 64; panning keeps 64 px of the
   levels in view. ED2D.6b's "the camera holds still while a drag is under way" falls out: nothing refits mid-drag.
3. **Duplicate and Remove** in the World inspector. Duplicate copies the level (`duplicateLevel`: fresh ids, refs inside
   the copy follow it) as `<name> copy`, selected, one step. Remove asks first and says how many links from other levels
   lead into it ("2 links lead here. They will show in Checks as broken.") and removes it as one step; the selection
   clears. A project keeps at least one level: Remove is disabled on the last one.

## Files

**Create:** `packages/editor-2d/src/app/world/world-camera.ts` (+ test), `world-gestures.ts` (+ test).
**Modify:** `app/world/WorldView.svelte` (attach gestures, the camera, Fit), `WorldInspector.svelte` (Duplicate,
Remove and its dialog), `world-model.ts` (+ test: `copyLevelInput`, `linksInto`), `WorldView.dom.test.ts`,
`world-view.layout.test.ts` (Fit and the inspector buttons at 44 px).
**Interfaces:** consumes the kit's `attachGestures`, `GestureHandlers`, `createViewport`; the model's `duplicateLevel`,
`removeLevel`, `projectLinks`. Produces nothing outside the World view.

## Steps

- [x] 1. Plan (this file).
- [x] 2. `world-camera`: fit on first measure, resize keeps the centre, pan, zoom about a point, fit again (unit).
- [x] 3. `world-gestures`: tap selects or clears, drag on a level moves it as one step, drag on space pans, pinch and
  wheel zoom, middle button pans, finger after pen navigates only, two- and three-finger taps (unit, with a fake target).
- [x] 4. The view attaches them; Fit; the existing World view DOM cases still pass (selection, drag, reorder, G-h).
- [x] 5. Duplicate and Remove (model helpers in unit tests; DOM: duplicate selected and one undo step; remove asks with
  the link count, removes in one step, disabled on the last level).
- [x] 6. Layout (three browsers): Fit and the new buttons are 44 px and in view at every size; review images with the
  `world` mockup frame.
- [x] 7. Gates: `pnpm format`, `TURBO_FORCE=true pnpm check`, editor-2d `test:parity` and `test:canvas`.

## Execution log

- 2026-10-31: plan written on `claude/ed2d-6c-links` at `1e2634be`.
- 2026-10-31, steps 2 and 3: `world-camera.test.ts` and `world-gestures.test.ts` failed on the missing modules, then
  pass (4 and 5 tests). The camera imports `createViewport` from the kit's `core` entry: the root entry also exports
  Svelte components, which the `unit` project cannot load.
- 2026-10-31, step 4: with the gestures attached, two World view DOM cases failed for reasons the plan predicts: the
  drag case aimed its second tap with a fit of the world after the move, and the camera now holds still (decision 2),
  so it aims every point with the first fit; the Row case switched the layout, which moves every level, so the view now
  fits again after a layout switch as after Add level (a refit only on steps that move every level). A logging run
  showed the tap arriving at the old fit's point. The camera case (wheel pans, Ctrl+wheel zooms, Fit restores) was
  written after the wiring and not run red first. World unit+dom: 7 files, 37 tests pass; typecheck 0 errors.
- 2026-10-31, step 5: `copyLevelInput` and `linksInto` cases failed (not functions), then pass; the Duplicate and
  Remove DOM cases failed (no buttons), then pass. World unit+dom: 7 files, 41 tests; typecheck 0 errors.
- 2026-10-31, step 6: the layout test checks Fit, Add level, Duplicate and Remove are 44 px and in view at every
  size (three browsers: 3 files, 24 tests). The first landscape image showed the map zoomed and cut off: the camera fit
  the first box the page reported (800 × 600) and only kept the centre when the real box came. Decision 2 now reads
  "fits every new box until the person pans or zooms; Fit hands it back": the camera case was changed first (failed,
  0.752 for 0.352), then the camera (passes). A new layout check that every level is inside the map across failed at
  six sizes with the old rule (left edges at -99 and -13 px) and passes with the new one. Images:
  `docs/evidence/owner-visual/2026-10-31-ed2d-8a/`.
- 2026-10-31, step 7 after merging `origin/claude/ed2d-6c-links` (already in) and `origin/main` (`5d9b46e9`, docs):
  `pnpm format` clean; `TURBO_FORCE=true pnpm check` exit 0 (37/37 and 35/35 tasks, 0 cached); editor-2d
  `test:parity` 24 files, 606 tests; `test:canvas` 14 files, 94 tests (12 opt-in visuals skipped).

# ED3D.5f Inspector cards and portrait layout: TDD plan

- **Task:** ED3D.5f in [02](../../02-master-delivery-plan.md), the second part of milestone "ED3D.5e–7d". [ED3D spec](../specs/2026-10-23-editor-3d-design.md) §5.3 flow 3 (inspector steppers; a drag is one transaction), §5.4 (`sector.setHeights`, `setLight`, `setMaterials`, `wall.setKind`, `setDoor`, `setWindow`, `setMaterial`, `setFlags`), §9 (the Split frame's sector card; the Portrait frame: compact top bar, floating tool strip, bottom sheet with Sector, Walls, Things and Checks tabs; rotation keeps the selection and the open draft), §10. Mockups `Split · landscape` (sector card), `Portrait`.
- **Lane:** editors. **Depends on:** ED3D.5e (this branch), ED3D.6g (#341: the tool rail and tools, merged into this branch before step 5), the model edits (ED3D.3, 6b, 8a), the kit's widgets (EDK.4).
- **Status:** Implemented and locally checked 2026-10-31; not CI verified; no real iPad run. Accepted under the Owner's "Auto accept all spec and plans" once reviewed. Steps are ticked only when their checks pass.
- **Progress:** 9 of 9 steps.

## Scope

**In:** the inspector's cards for what is selected: the sector card (floor and ceiling steppers, light slider, style and the three textures, the camera view), the wall card (kind: solid, portal, door, window; the door's and window's place and size; material; occlude; handrail, frame and mask flags), the thing card (its definition, id and place; the field form is ED3D.7d); none selected says how to select. Each change is the model's edit, one undo step (a scrub of a stepper or the slider is one step through a session); a refusal shows the model's sentence. At `wide` the cards are the inspector column; below `wide` the portrait layout: the inspector is the shell's bottom sheet with Sector, Walls, Things and Checks tabs, and a floating tool strip (the rail's tools, Fit, Layers and the views: Plan, 3D) over the canvas. Rotation keeps the selection and an open drawing.

**Out:** the camera-view card's 24 mm preview and heading slider (a follow-up part, ED3D.5f-b: it needs a third renderer camera); the material sheet (ED3D.8b; the card lists the material's name and a Change button that is disabled until 8b, saying so); the Things form (ED3D.7d); the Checks tab's list content beyond the counts and Locate (ED3D.10b).

## Decisions (veto-defaults)

1. **One headless card model** (`app/inspector-cards.ts`): `inspectorOf(editor)` reads the selection and the level into a plain card (sector, wall, thing or none), and `inspectorEdits(editor)` turns a widget's edit event into the model's edit: `set` runs it as one step; `start`, `update` and `commit` run it in one session, so a scrub is one undo step; `cancel` drops the session.
2. **A selection of several** shows the first selected item's card and says how many are selected (the mockup has no multi-edit; a follow-up).
3. **The Portrait tool strip** carries the rail's tools, Fit and Layers, and Plan/3D; the views move there below `wide` (the bar has no room), so 3D is reachable at `medium` (ED3D.5e left that open).

4. **The inspector column only on a wide window of 1100 px or more** (iPad mini landscape, 1133, keeps it): below that the rail, the layers and the column leave the plan a few hundred pixels, too little for its toolbar, lens, pad and actions; the status line names what is selected there. The draw actions move to the plan's foot on the left (the mockup's place), clear of the nudge pad on the right, and swap sides when the pad does.

## Interfaces

**Produced (editor-private):** `app/inspector-cards.ts` (`inspectorOf`, `InspectorCard`), `app/inspector-edits.ts` (`createInspectorEdits`, `InspectorChange`), `ui/inspector/{SectorCard,WallCard,Inspector}.svelte` (the thing card is a few lines in `Inspector.svelte` until ED3D.7d's form), `ui/inspector/PortraitSheet.svelte`, `ui/plan/ToolStrip.svelte`.

## Steps

- [x] 1. Plan (this file).
- [x] 2. `inspectorOf` (unit, red first): none; the hall's sector card (heights, light, style, textures, view); a wall's card (kind, length, door and window, material, occlude, flags) for a solid, a portal, a door and a window wall; a thing's card; several selected says how many.
- [x] 3. `inspectorEdits` (unit, red first): `set` on the floor is one undo step named for it; `start`/`update`×3/`commit` on the light is one step; `cancel` leaves the level as it was; a refused height (floor over ceiling) changes nothing and answers the model's sentence; wall kind, door, window, occlude and flags edits each one step.
- [x] 4. `SectorCard`, `WallCard`, `ThingCard`, `Inspector` (DOM, red first): fields from the card; a stepper press runs one step; a refusal is shown in words; 44 px targets; the none card's words.
- [x] 5. Merge `origin/main` (with #341, ED3D.6g) and wire the inspector into `DocumentFrame` at `wide` (DOM): selecting the hall shows its card; changing its floor is one undo step on Undo's label.
- [x] 6. `ToolStrip` and `PortraitSheet` (DOM): below `wide` the strip shows the tools, Fit, Layers and Plan/3D; the sheet's tabs show the card, the walls of the selected sector, the things, and the checks' counts; choosing a tab keeps the selection.
- [x] 7. Rotation (DOM and layout): `wide` → `medium` and back keeps the selection, the open sheet tab and an open drawing.
- [x] 8. Layout (three browsers) at every size: the cards' controls on screen at full size, scrolled to in the inspector or the sheet; the strip clear of the status line and the sheet's peek; review images beside the `Split` sector card and `Portrait` mockups in `docs/evidence/owner-visual/2026-10-31-ed3d-5f/`.
- [x] 9. Gates: biome, `pnpm format`, `TURBO_FORCE=true pnpm check`; editor-3d `test:parity`. No changeset (private package).

## Execution log
- 2026-10-31, step 2: `inspector-cards.test.ts` red (module missing), then 6 of 6.
- 2026-10-31, step 3: `inspector-edits.test.ts` red (module missing), then 5 of 5. The edits live in their own file, `app/inspector-edits.ts` (`createInspectorEdits(editor).change(change, phase)`), not beside the cards: the cards only read.
- 2026-10-31, step 4: `Inspector.dom.test.ts` red (component missing), then 7 of 7 after one test fix: the kit's stepper is a spinbutton whose value is its number (`aria-valuenow`), not a formatted string. `app/inspector-edits.ts` declares `InspectorPhase` (the kit's `EditPhase` written out) because the architecture test keeps `app/` off the kit's root and `core` does not export it.
- 2026-10-31, step 5: merged #341's accepted branch (ED3D.6g) rather than `origin/main`, where it had not landed yet, so the frame is reconciled once (both sides kept in `DocumentFrame`: 6g's rail, keys and tools; 5e's Split and 3D). editor-3d `test:unit` 2835 of 2835 after the merge. Then the inspector column at `wide`: the `DocumentFrame` test red (no inspector), then 18 of 18.
- 2026-10-31, step 6: the rows (`wallRowsOf`, `thingRowsOf`) red then 8 of 8; the portrait `DocumentFrame` test red, then green after one fix (the rows did not follow the selection until derived from the frame's reactive selection and card). Below `wide`: no shell rail; the tools float over the plan's foot (`tool-strip`, with `--plan-foot` lifting the draw actions above it); the bar offers Plan and 3D (`modeOptions({ narrow })`, tested); the inspector is the shell's dock sheet (`PortraitSheet`) with Sector, Walls, Things and Checks. editor-3d `src/ui` DOM 94 of 94; `svelte-check` 0 errors. This replaces 6g's tab-bar rail at `medium` with the mockup's floating strip.
- 2026-10-31, step 7: the rotation test red (the sheet's tab reset when the sheet left at `wide`), then green with the tab bound to the frame; 95 of 95. The tools (and so an open drawing, which lives in the Sector tool) are the frame's and survive the change; the canvas is not remounted (its `{#if}` branch is unchanged), as ED3D.5d's rotation journey already checks.
- 2026-10-31, step 8 (layout), what the runs found and changed:
  - The shell's bottom sheet covered the floating strip; the strip and the plan's foot controls (`--plan-foot`) now stand on the shell's `--dock-lift`, and the nudge pad is placed by side with CSS (`nudgePlace` returns `'left' | 'right'`; its tests and the pad's follow) so it stands above them too.
  - The strip squeezed "Window" (the rail's tab-bar sizing): strip buttons are as wide as their names.
  - In the short peek sheet the flex column shrank the tab row under the panel (a stepper's label was on top of the tabs): the tab row keeps its height and stays in view as the sheet scrolls.
  - With the inspector column at `wide`, a 900 px window left the plan 260 px and iPad mini landscape put the pad over Close sector: decision 4.
  - Then `inspector.layout.test.ts`, `draw-journeys`, `sector-tools`, `split-view`, `plan-view` and the document layouts in Chromium, WebKit and Firefox: 279 passed and 6 skipped (phone journeys) with the 900 px inspector case failing as expected before its test was updated to assert the new behaviour; then that file 18 of 18.
- 2026-10-31, step 8 (cont.): walls are counted from 1 in the card and the Walls tab, as the status line counts them (the model's undo labels still count from 0: a follow-up); the cards put one stepper to a row (two side by side wrapped their buttons in the 320 px column). Review images and README in `docs/evidence/owner-visual/2026-10-31-ed3d-5f/`.
- 2026-10-31, step 9: `TURBO_FORCE=true pnpm check` exit 0. editor-3d `test:parity` first run: 378 passed, 6 skipped, but exit 1 on 12 unhandled errors in `plan-view.layout.test.ts`'s rotation journey: the kit's `EditorShell` handed `ResizeObserver.observe` a null binding once the rail was taken away while shown (the 3D editor now has no rail below `wide`). A kit fix, red first: `editor-kit/src/shell/editor-shell-measure.test.ts` (a strict observer stub, the rail removed) failed with the browser's TypeError, then passed with the shell measuring only elements that are there; kit unit 80 of 80, kit shell layout (Chromium) 79 of 79. editor-kit is private, so no changeset. Then editor-3d `test:parity`: 378 passed, 6 skipped, exit 0, no unhandled errors.

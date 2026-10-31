# ED3D.5f Inspector cards and portrait layout: TDD plan

- **Task:** ED3D.5f in [02](../../02-master-delivery-plan.md), the second part of milestone "ED3D.5e–7d". [ED3D spec](../specs/2026-10-23-editor-3d-design.md) §5.3 flow 3 (inspector steppers; a drag is one transaction), §5.4 (`sector.setHeights`, `setLight`, `setMaterials`, `wall.setKind`, `setDoor`, `setWindow`, `setMaterial`, `setFlags`), §9 (the Split frame's sector card; the Portrait frame: compact top bar, floating tool strip, bottom sheet with Sector, Walls, Things and Checks tabs; rotation keeps the selection and the open draft), §10. Mockups `Split · landscape` (sector card), `Portrait`.
- **Lane:** editors. **Depends on:** ED3D.5e (this branch), ED3D.6g (#341: the tool rail and tools, merged into this branch before step 5), the model edits (ED3D.3, 6b, 8a), the kit's widgets (EDK.4).
- **Status:** Drafted 2026-10-31. Accepted under the Owner's "Auto accept all spec and plans" once reviewed. Steps are ticked only when their checks pass.
- **Progress:** 5 of 9 steps.

## Scope

**In:** the inspector's cards for what is selected: the sector card (floor and ceiling steppers, light slider, style and the three textures, the camera view), the wall card (kind: solid, portal, door, window; the door's and window's place and size; material; occlude; handrail, frame and mask flags), the thing card (its definition, id and place; the field form is ED3D.7d); none selected says how to select. Each change is the model's edit, one undo step (a scrub of a stepper or the slider is one step through a session); a refusal shows the model's sentence. At `wide` the cards are the inspector column; below `wide` the portrait layout: the inspector is the shell's bottom sheet with Sector, Walls, Things and Checks tabs, and a floating tool strip (the rail's tools, Fit, Layers and the views: Plan, 3D) over the canvas. Rotation keeps the selection and an open drawing.

**Out:** the camera-view card's 24 mm preview and heading slider (a follow-up part, ED3D.5f-b: it needs a third renderer camera); the material sheet (ED3D.8b; the card lists the material's name and a Change button that is disabled until 8b, saying so); the Things form (ED3D.7d); the Checks tab's list content beyond the counts and Locate (ED3D.10b).

## Decisions (veto-defaults)

1. **One headless card model** (`app/inspector-cards.ts`): `inspectorOf(editor)` reads the selection and the level into a plain card (sector, wall, thing or none), and `inspectorEdits(editor)` turns a widget's edit event into the model's edit: `set` runs it as one step; `start`, `update` and `commit` run it in one session, so a scrub is one undo step; `cancel` drops the session.
2. **A selection of several** shows the first selected item's card and says how many are selected (the mockup has no multi-edit; a follow-up).
3. **The Portrait tool strip** carries the rail's tools, Fit and Layers, and Plan/3D; the views move there below `wide` (the bar has no room), so 3D is reachable at `medium` (ED3D.5e left that open).

## Interfaces

**Produced (editor-private):** `app/inspector-cards.ts` (`inspectorOf`, `InspectorCard`), `app/inspector-edits.ts` (`createInspectorEdits`, `InspectorChange`), `ui/inspector/{SectorCard,WallCard,Inspector}.svelte` (the thing card is a few lines in `Inspector.svelte` until ED3D.7d's form), `ui/inspector/PortraitSheet.svelte`, `ui/plan/ToolStrip.svelte`.

## Steps

- [x] 1. Plan (this file).
- [x] 2. `inspectorOf` (unit, red first): none; the hall's sector card (heights, light, style, textures, view); a wall's card (kind, length, door and window, material, occlude, flags) for a solid, a portal, a door and a window wall; a thing's card; several selected says how many.
- [x] 3. `inspectorEdits` (unit, red first): `set` on the floor is one undo step named for it; `start`/`update`×3/`commit` on the light is one step; `cancel` leaves the level as it was; a refused height (floor over ceiling) changes nothing and answers the model's sentence; wall kind, door, window, occlude and flags edits each one step.
- [x] 4. `SectorCard`, `WallCard`, `ThingCard`, `Inspector` (DOM, red first): fields from the card; a stepper press runs one step; a refusal is shown in words; 44 px targets; the none card's words.
- [x] 5. Merge `origin/main` (with #341, ED3D.6g) and wire the inspector into `DocumentFrame` at `wide` (DOM): selecting the hall shows its card; changing its floor is one undo step on Undo's label.
- [ ] 6. `ToolStrip` and `PortraitSheet` (DOM): below `wide` the strip shows the tools, Fit, Layers and Plan/3D; the sheet's tabs show the card, the walls of the selected sector, the things, and the checks' counts; choosing a tab keeps the selection.
- [ ] 7. Rotation (DOM and layout): `wide` → `medium` and back keeps the selection, the open sheet tab and an open drawing.
- [ ] 8. Layout (three browsers) at every size: the cards' controls on screen at full size, scrolled to in the inspector or the sheet; the strip clear of the status line and the sheet's peek; review images beside the `Split` sector card and `Portrait` mockups in `docs/evidence/owner-visual/2026-10-31-ed3d-5f/`.
- [ ] 9. Gates: biome, `pnpm format`, `TURBO_FORCE=true pnpm check`; editor-3d `test:parity`. No changeset (private package).

## Execution log
- 2026-10-31, step 2: `inspector-cards.test.ts` red (module missing), then 6 of 6.
- 2026-10-31, step 3: `inspector-edits.test.ts` red (module missing), then 5 of 5. The edits live in their own file, `app/inspector-edits.ts` (`createInspectorEdits(editor).change(change, phase)`), not beside the cards: the cards only read.
- 2026-10-31, step 4: `Inspector.dom.test.ts` red (component missing), then 7 of 7 after one test fix: the kit's stepper is a spinbutton whose value is its number (`aria-valuenow`), not a formatted string. `app/inspector-edits.ts` declares `InspectorPhase` (the kit's `EditPhase` written out) because the architecture test keeps `app/` off the kit's root and `core` does not export it.
- 2026-10-31, step 5: merged #341's accepted branch (ED3D.6g) rather than `origin/main`, where it had not landed yet, so the frame is reconciled once (both sides kept in `DocumentFrame`: 6g's rail, keys and tools; 5e's Split and 3D). editor-3d `test:unit` 2835 of 2835 after the merge. Then the inspector column at `wide`: the `DocumentFrame` test red (no inspector), then 18 of 18.

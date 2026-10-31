# ED3D.7d Things layer UI: TDD plan

- **Task:** ED3D.7d in [02](../../02-master-delivery-plan.md), the third part of milestone "ED3D.5e–7d". [ED3D spec](../specs/2026-10-23-editor-3d-design.md) §4.7 (things are instances of entity definitions; the palette lists the definitions), §5.2 (one sub-layer per definition; a hidden layer is not drawn, a locked one not hit), §5.4 (`thing.add`, `thing.move`, `thing.remove`, `thing.setField`), §9, §13 (ED3-r placement). Mockup `Split · landscape` (the Things rail tools, the layers).
- **Lane:** editors. **Depends on:** ED3D.7b (`createThingsTool`), ED3D.7a (thing edits), ED3D.5f (the inspector, this branch), ED3D.6g (the tool switcher, merged into this branch).
- **Status:** Drafted 2026-10-31. Accepted under the Owner's "Auto accept all spec and plans" once reviewed. Steps are ticked only when their checks pass.
- **Progress:** 4 of 8 steps.

## Parts

- **7d-a (this plan's steps 1–6):** the Things tool in the plan's switcher, its rail button and key, the palette, placing and moving things with taps and drags, the place preview, Delete (key and the thing card's button).
- **7d-b (steps 7–8):** the thing card's field form and the ED3-r placement journey. The instance-value form is editor-2d's `level/FieldEditor.svelte` today; `FieldDef` is the kit's contract, so 7d-b first moves that form into `editor-kit` (one owner, used by both editors) once ED2D.6–8 (#332) is on `main`, rather than copying it here. Defining a new entity (ED3-r's first half) is ED3D.13.

## Decisions (veto-defaults)

1. **One Things tool, `T`,** with the palette as its options (as the Sector tool has its shapes): the mockup's Prop, Spot, Lamp, Spawn, Nav and Zone buttons are the depot's or Last Light's definitions, which differ by profile, so they are palette entries, not rail buttons.
2. **Drags with the Things tool move things** (the tool's own drag), and a drag on nothing draws an area for a definition that has one; two fingers still pan and zoom through Select.
3. **Delete removes the selected things** (the `Delete` key; Backspace stays the Sector tool's Undo point).

## Interfaces

**Produced (editor-private):** `PlanToolId` gains `'things'` and `PlanTools.things`; `toolPaint` paints the place preview and an area; `ui/plan/ThingsPalette.svelte`; `planToolCommands` gains `T` and `Delete`; `InspectorChange` gains `{ kind: 'thing', remove }` and the thing card a Delete button.

## Steps

- [x] 1. Plan (this file).
- [x] 2. `createPlanTools` with `'things'` (unit, red first): `choose('things')` makes the Things tool; a tap with a definition picked places it as one undo step; a drag moves a thing as one step; leaving the tool disposes it.
- [x] 3. `planToolCommands` (unit): `T` chooses Things; `Delete` removes the selected things as one step and falls through with nothing selected.
- [x] 4. `toolPaint` for Things (unit): the place preview at its point in the definition's colour, red with the sentence when a tap would be refused; an area's rectangle.
- [ ] 5. `ThingsPalette` and the rail (DOM): the palette lists the definitions with their colours; picking one marks it; a hidden or locked definition says why it cannot be picked; the rail has Things with `T`. The thing card's Delete removes it (DOM).
- [ ] 6. Layout (three browsers): the palette's entries at full size, clear of the status line and the strip; a Things journey (pick crate, tap the dock: a crate is added; drag it: one step; Delete). Review images. Gates for 7d-a.
- [ ] 7. 7d-b: the field form in the kit (moved from editor-2d), the thing card's fields with refusals (DOM, both editors' tests green).
- [ ] 8. 7d-b: ED3-r placement journey (place two crates, set a field, Save, reopen: both and the value are in the file; a second `spawn` is refused by `single`); gates.

## Execution log
- 2026-10-31, step 2: three `plan-tools` tests red (no Things tool), then 14 of 14: the Things tool in the switcher; its drags move things (not pan).
- 2026-10-31, step 3: the `T`/`Delete` test red, then 5 of 5. `planToolCommands(tools, selected)` takes the selection for Delete's enabled state.
- 2026-10-31, step 4: the Things `toolPaint` test and its case were written in one edit, so the test was not seen red first; 8 of 8 (the place ring, the refusal sentence, an area's dashed rectangle). editor-3d `src/app` unit: 597 of 597.

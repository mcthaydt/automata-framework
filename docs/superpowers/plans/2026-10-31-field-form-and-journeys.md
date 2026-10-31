# Field form in the kit, ED3D.7d-b and the ED2D.8 journeys: TDD plan (one milestone)

- **Rows:** ED3D.7d (second part, 7d-b) and ED2D.8 in [02](../../02-master-delivery-plan.md), as one editors milestone (Owner, 2026-10-31: "PRs should be milestone level"; the coordinator queued the ED2D.8 journeys after ED3D.5e–7d, #350, and 7d-b joins them because both touch editor-2d). One branch (`claude/editors-field-form-journeys`), one commit series per part, one PR when the milestone is done.
- **Specs:** [editor kit spec](../specs/2026-10-23-editor-kit-design.md) §4.8 (`FieldDef`, the kit owns the field contract); [ED3D spec](../specs/2026-10-23-editor-3d-design.md) §4.7, §5.4 (`thing.setField`), §13 ED3-r; [2D editor spec](../specs/2026-10-23-editor-2d-design.md) §8, §12, §13 and its journeys (G-k: a stroke cancelled by rotation without a remount).
- **Lane:** editors. **Depends on:** ED2D.6–8 (#332, merged), EDK.6b (#337, merged: `journeyProject`, `createPointers`, `IPAD_PROFILES`, `turned`), ED3D.7d-a (#350, open: the thing card this form fills; part B merges #350's branch or `main` once it lands).
- **Status:** Drafted 2026-10-31. Accepted under the Owner's "Auto accept all spec and plans" once reviewed. Steps are ticked only when their checks pass.
- **Progress:** 0 of 12 steps.

## Parts

### A. The field form in the kit (one owner for both editors)

editor-2d's `app/level/FieldEditor.svelte`, `RefPicker.svelte` and the pure field-to-widget map in `inspector-model.ts` (`FieldRow`, `FieldWidget`, `fieldRow`) edit values of the kit's `FieldDef`; the 3D editor needs the same form for its things. They move to `editor-kit` (the kit owns `FieldDef`), with the ref target generalised from editor-2d's `RefTargetLevel` (`level`, `name`, `choices`) to the kit's `RefTargetGroup` (`id`, `name`, `choices`), which editor-2d's `refTargets` already produces under another key name. editor-2d imports them from the kit; its four call sites (`LevelTab`, `EntityTab`, `WorldInspector`, `FieldDefEditor`) keep their behaviour and tests.

- [ ] A1. `fieldRow` and `FieldWidget` in `editor-kit/src/fields/field-row.ts` (unit, moved with their tests from `inspector-model.test.ts`; red first in the kit: module missing).
- [ ] A2. `FieldEditor.svelte` and `RefPicker.svelte` in `editor-kit/src/fields/` (DOM, moved with `FieldEditor.dom.test.ts`), exported from the kit root; `RefTargetGroup` in `fields`.
- [ ] A3. editor-2d imports them from the kit; its copies are deleted; `refTargets` returns `RefTargetGroup`s. editor-2d unit and DOM, layout (three browsers) green; knip clean.

### B. ED3D.7d-b: the thing card's fields and ED3-r placement

- [ ] B1. `inspectorOf` gives a thing card its field rows (`fieldRow` over the definition's `FieldDef`s and the thing's values) and its ref targets (the level's things a `ref` may name); `InspectorChange` gains `{ kind: 'thing', field, value }` → `setThingField` (unit, red first; a value the field rejects answers the model's sentence and changes nothing).
- [ ] B2. The thing card renders the kit's `FieldEditor` per row (DOM): a stepper press sets a number field as one step; a refused value shows under the field.
- [ ] B3. ED3-r placement journey (layout, three browsers): pick crate, place two, set one's field, Save, reopen: both crates and the value are in the file; picking spawn and placing a second is refused by `single`, in words.

### C. ED2D.8: Pencil and touch polish, accessibility, journeys

- [ ] C1. The Pencil hover footprint on the level canvas (the brush's cells under a hovering Pencil), and a two-finger tap undoes (DOM and canvas tests).
- [ ] C2. A stroke cancelled by rotation without a remount (G-k): a paint stroke in progress when the iPad turns is cancelled (no half step), the canvas is the same element and the selection stays (journey).
- [ ] C3. Short height keeps the tools, Undo, the layers and Export reachable (layout at the short iPad sizes, three browsers).
- [ ] C4. Accessibility pass: every control named, focus order through the bar, the rail, the canvas and the inspector, announcements for undo/redo and a refusal (DOM tests); "last open project" on Home (unit and DOM).
- [ ] C5. WebKit iPad journeys with the EDK.6b harness (`*.journey.test.ts`, `test:journeys`): platformer (paint, place, check, export), RPG (top-down template, tiles, entities), linking two maps (a door each way on the World map), the retype refusal, rotation mid-stroke.
- [ ] C6. Gates: biome, `pnpm format`, `TURBO_FORCE=true pnpm check`; editor-2d and editor-3d `test:parity`; editor-2d `test:journeys`; review images for the visual parts beside their mockups. The kit is private, the editors are private: no changeset.

## Execution log

# ED2D.4c4b The Level view's inspector, dock and shortcuts: TDD plan

- **Task:** ED2D.4c4b in [02](../../02-master-delivery-plan.md). [2D editor spec](../specs/2026-10-23-editor-2d-design.md) §8 (the Level row: inspector tabs Entity / Level / Checks, the dock of level cards; flow 3), §8.4 (what 4c4a left), §12 (sizes, shortcuts, short height), §15 G-e.
- **Lane:** editor-2d (editors lane). **Depends on:** ED2D.4c4a (#267, merged). **Unblocks:** ED2D.5b, ED2D.5c, ED2D.7a.
- **Status:** Drafted 2026-10-30. Accepted under the Owner's "Auto accept all spec and plans" (2026-10-30) once reviewed. Not implemented.
- **Progress:** 1 of 9 steps.

## Scope

**In:**
- The inspector (320 px in `wide`, the kit's drawer in `medium` and sheet in `compact`) with the kit `Tabs`: **Entity** (the selected instance's typed fields from its definition, plus position and size), **Level** (the level's name, size and fields), **Checks** (the profile's diagnostics for this level, read only, each one tapping to select its object).
- The dock (148 px under the canvas in `wide`; a bottom sheet below `wide`; on the short `wide` height, hidden until a toolbar button or the chip over the canvas opens it): the world's levels as cards; tapping one is `setLevel`.
- The keyboard shortcuts of §12, with Pencil and touch reaching the same actions through visible controls (nothing is keyboard-only or hover-only).
- G-e through the UI, and the Level view placing an entity and editing it end to end in jsdom.

**Out (owner):** the reference picker and level links (ED2D.6c; a `ref` field shows its value and "Choose target" opens the pending picker message); fixes on diagnostics (ED2D.7a); the World view (ED2D.6b); the Pencil hover footprint, two-finger-tap polish and accessibility pass (ED2D.8); G-q (ED2D.10).

## Interfaces

**Consumed:** `LevelEditor` and `LevelEditorView` (`app/level-editor.ts`: `selected`, `setLevel`, `setTool`, `setBrushSize`); `LevelSession` (`app/level/level-session.ts`); `setEntityField`, `moveEntity`, `resizeEntity`, `deleteEntity`, `duplicateEntity` (`model/commands/entity-edits.ts`); `setLevelField` (`model/world/level-edits.ts`), `resizeLevel`; `checkFieldValue` (the refusal message); the profile's checks (`Profile.check`); `History.apply` through `app/level/edit-history.ts` (one step per committed field); kit `Tabs`, `Stepper`, `Slider`, `Segmented`, `ColorField`, `Picker`, `Button`, `EditorShell` (`inspector`, `dock`, `inspectorOpen`, `dockOpen`).

**Produced (all in `packages/editor-2d/src/app/level/`, private):**
- `inspector-model.ts`: `entityInspector(project, level, selected)` → `{ instance, def, fields: FieldRow[] } | { none: reason }`, `levelInspector(project, level)`, `FieldRow { id, label, type, value, widget, bounds?, options? }` (the widget a field type maps to: int/float → Stepper with bounds, bool → Segmented, enum → Segmented or Picker past five options, color → ColorField, string → text, point list → rows of x/y Steppers, ref → value and "Choose target").
- `field-commit.ts`: `commitField(history, target, field, value)` → `{ ok: true } | { ok: false, message }`; a refusal (the command's `RangeError`) applies nothing and returns `checkFieldValue`'s message.
- `dock-model.ts`: `levelCards(project, world)` → `{ id, name, size, current }[]`, in the world's order.
- `level-shortcuts.ts`: `shortcutFor(event, context)` → an action name or `undefined`; the context says whether focus is in a text field (then only `Mod+Z` / `Mod+Shift+Z` pass).
- Components `Inspector.svelte`, `EntityTab.svelte`, `LevelTab.svelte`, `ChecksTab.svelte`, `FieldEditor.svelte`, `LevelDock.svelte`; `LevelView.svelte` passes `inspector` and `dock` to the shell (so `data-inspector="none"` no longer applies to the Level view).

## Decisions made here (defaults, listed for the Owner's veto)

1. **A field commits on change for steppers, toggles and pickers, and on blur or Enter for text**, one undo step each; a refused value shows the message under the field and puts the field back to the stored value (G-e).
2. **Nothing selected:** the Entity tab says "Select a thing on the canvas to see its fields" and the inspector opens on the Level tab; one selected opens on Entity; several selected show the count and only Delete and Duplicate.
3. **Shortcuts are ignored while focus is in a text field**, except undo and redo; arrows nudge only when the canvas or the inspector's position row has focus, so a list's arrow keys keep working.
4. **The dock's chip** on short `wide` heights is a 44 px button in the toolbar row ("Levels"), not a floating chip over the canvas, so it never covers drawing.

## Files

| File | What |
|---|---|
| `app/level/inspector-model.ts` + `.test.ts` | field rows per type; none/one/many selection |
| `app/level/field-commit.ts` + `.test.ts` | one step per commit; refusal keeps the value (G-e in Node) |
| `app/level/dock-model.ts` + `.test.ts` | the cards in world order, the current one marked |
| `app/level/level-shortcuts.ts` + `.test.ts` | the §12 map; text-field focus rule |
| `app/level/FieldEditor.svelte` + `.dom.test.ts` | one row per widget kind, refusal message, value restored |
| `app/level/Inspector.svelte`, `EntityTab.svelte`, `LevelTab.svelte`, `ChecksTab.svelte` + `inspector.dom.test.ts` | tabs, default tab by selection, Checks selects its object |
| `app/level/LevelDock.svelte` + `.dom.test.ts` | cards, tap switches level, focus kept |
| `app/level/LevelView.svelte`, `level-view.dom.test.ts`, `level-view.layout.test.ts` | inspector and dock wired; shortcuts on the view; the eight sizes in three browsers |
| `docs/evidence/owner-visual/2026-10-30-ed2d-4c4b/` | review images and README table |

## Steps

Each step: the test first, run `pnpm --filter @mcthaydt/automata-editor-2d exec vitest run <file>` and see it fail for the named reason, then the code.

- [x] 1. **Plan** (this file).
- [ ] 2. **Inspector model.** Fails: no module. Every field type of the `platformer` template's definitions maps to its widget with bounds and options; none, one and several selected.
- [ ] 3. **Field commit.** Fails: no module. G-e in Node: int past its max, a bad enum, a bad colour, a point list with a non-integer and a missing ref are refused with the message and the project is unchanged; a valid edit is one undo step that undoes.
- [ ] 4. **Dock model and shortcuts.** Fails: no modules. Cards in world order with the current level; every §12 shortcut maps; text-field focus blocks all but undo and redo; shift-arrow nudges 8.
- [ ] 5. **FieldEditor.** jsdom: each widget kind renders at 44 px targets; typing a refused value shows the message and restores the stored value.
- [ ] 6. **Inspector and tabs.** jsdom: the default tab follows the selection; Checks lists this level's diagnostics and tapping one selects its object; the multi-selection actions.
- [ ] 7. **Dock.** jsdom: the cards; a tap switches the level and the canvas refits; the short-height toolbar button opens it.
- [ ] 8. **Level view wired.** jsdom journey: place an entity, edit an int, an enum and a colour, refuse one, undo; shortcuts B, R, G, E, I, `[`, `]`, Delete, `Mod+D`, arrows. Layout: the eight sizes in Chromium, WebKit and Firefox (inspector 320 and dock 148 in `wide`, drawers and sheets below it, the short height keeps tools, undo, layers and Export; hit targets clear of a scroll region's end edge).
- [ ] 9. **Review images** at 1194×834, 834×1194, 1133×744 and phone, with a README table; gates.

## Gates

`pnpm format`; `TURBO_FORCE=true pnpm check`; `pnpm --filter @mcthaydt/automata-editor-2d test:unit`, `test:layout` (three browsers) and `test:canvas`; no changeset (private); `pnpm api-report` if the kit's exports change (they should not).

## Execution log

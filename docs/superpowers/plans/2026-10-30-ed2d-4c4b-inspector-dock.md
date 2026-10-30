# ED2D.4c4b The Level view's inspector, dock and shortcuts: TDD plan

- **Task:** ED2D.4c4b in [02](../../02-master-delivery-plan.md). [2D editor spec](../specs/2026-10-23-editor-2d-design.md) §8 (the Level row: inspector tabs Entity / Level / Checks, the dock of level cards; flow 3), §8.4 (what 4c4a left), §12 (sizes, shortcuts, short height), §15 G-e.
- **Lane:** editor-2d (editors lane). **Depends on:** ED2D.4c4a (#267, merged). **Unblocks:** ED2D.5b, ED2D.5c, ED2D.7a.
- **Status:** Drafted 2026-10-30. Accepted under the Owner's "Auto accept all spec and plans" (2026-10-30) once reviewed. Implemented and locally checked 2026-10-30; CI and the Owner's visual acceptance pending.
- **Progress:** 9 of 9 steps.

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
- [x] 2. **Inspector model.** Fails: no module. Every field type of the `platformer` template's definitions maps to its widget with bounds and options; none, one and several selected.
- [x] 3. **Field commit.** Fails: no module. G-e in Node: int past its max, a bad enum, a bad colour, a point list with a non-integer and a missing ref are refused with the message and the project is unchanged; a valid edit is one undo step that undoes.
- [x] 4. **Dock model and shortcuts.** Fails: no modules. Cards in world order with the current level; every §12 shortcut maps; text-field focus blocks all but undo and redo; shift-arrow nudges 8.
- [x] 5. **FieldEditor.** jsdom: each widget kind renders at 44 px targets; typing a refused value shows the message and restores the stored value.
- [x] 6. **Inspector and tabs.** jsdom: the default tab follows the selection; Checks lists this level's diagnostics and tapping one selects its object; the multi-selection actions.
- [x] 7. **Dock.** jsdom: the cards; a tap switches the level and the canvas refits; the short-height toolbar button opens it.
- [x] 8. **Level view wired.** jsdom journey: place an entity, edit an int, an enum and a colour, refuse one, undo; shortcuts B, R, G, E, I, `[`, `]`, Delete, `Mod+D`, arrows. Layout: the eight sizes in Chromium, WebKit and Firefox (inspector 320 and dock 148 in `wide`, drawers and sheets below it, the short height keeps tools, undo, layers and Export; hit targets clear of a scroll region's end edge).
- [x] 9. **Review images** at 1194×834, 834×1194, 1133×744 and phone, with a README table; gates.

## Gates

`pnpm format`; `TURBO_FORCE=true pnpm check`; `pnpm --filter @mcthaydt/automata-editor-2d test:unit`, `test:layout` (three browsers) and `test:canvas`; no changeset (private); `pnpm api-report` if the kit's exports change (they should not).

## Execution log

- 2026-10-30, step 2: `inspector-model.test.ts` failed on the missing module, then 7 passed. The platformer template has no `bool`, `enum` or `angle` field, so those rows use hand-made definitions. Deviations: a row shows the kit's stand-in (`valuesWithDefaults`) when the holder stores no value (the template's level stores no `music`); `angle` is a stepper without bounds; a multi-line `text` is a `multiline` widget; a list of anything but points is a `list` row, shown and not yet edited (no template has one).
- 2026-10-30, step 3: `field-commit.test.ts` failed on the missing module, then 7 passed. Deviation: the kit accepts any finite point, so the point-list refusal is a non-number (`NaN`) rather than a non-integer; the commit label is "Set <field label>".
- 2026-10-30, step 4: `dock-model.test.ts` and `level-shortcuts.test.ts` failed on the missing modules, then 6 passed. `levelCards` takes the open level as a third argument (to mark it). `shortcutFor` returns `{ action, … }` rather than a bare name, since a nudge and a brush step carry an amount; nudges are in cells. Deviation: `Backspace` deletes as `Delete` does (a Mac keyboard's delete key sends it).
- 2026-10-30, step 5: `FieldEditor.dom.test.ts` was written before the component but first run after it (the only failure seen was the missing module), then 10 passed. A refusal remounts the control on the stored value (`{#key revision}`); a stepper shows the message through its own `error`, the rest under the field. The 44 px targets are checked by the layout test (step 8), not jsdom. A point list has Add point and per-row Remove buttons, since a list that starts empty needs a way to grow. "Choose target" says the canvas picker is coming (ED2D.6c).
- 2026-10-30, step 6 (models): `selection-edits.ts` (delete, duplicate one cell on, nudge in cells; a `single` definition is not duplicated) failed on the missing module, then 4 passed; `commitEdit` (the general one-step commit `commitField` now uses) and `levelChecks` (this level's findings, with the instance id that tapping selects) failed as "not a function", then passed (57 in `app/level`). The Checks tab runs the profile's `check` with no asset list, so the asset checks (definition-level, not shown here) do not run.
- 2026-10-30, step 6: `inspector.dom.test.ts` failed on the missing `Inspector.svelte`, then 6 passed. The controller gained `select(ids)` (its test failed as "not a function", then the 79 controller tests passed), which the Checks rows and a duplicate use. Deviations: the Level tab shows the name and size without editing them (renaming, and a resize that may lose cells, belong to the World view, ED2D.6b); arrows nudge only from the canvas, since the position row's steppers already own their arrow keys (decision 3 narrowed); the colour fields offer the definitions' own colours first.
- 2026-10-30, step 7: `LevelDock.dom.test.ts` failed on the missing component, then 2 passed (cards with size, the open one `aria-current`, a tap opens and focus stays on the card). The toolbar gained Inspector (below `wide`) and Levels (wherever the dock is a sheet, decision 4) buttons.
- 2026-10-30, step 8 (in progress, not ticked): `LevelView.svelte` passes `inspector` and `dock` to the shell, runs the profile's checks for the Checks tab, opens a level from the dock and refits, and handles the §12 shortcuts on the document (undo and redo through the app's services; delete, duplicate and nudge as one step each through `commitEdit`; the canvas surface takes focus, `tabindex="0"`, so arrows nudge from it). The 32 existing and new `app/level` DOM tests pass and `svelte-check` is clean. Still to do: the jsdom journey and shortcut tests in `LevelView.dom.test.ts`, and `level-view.layout.test.ts` at the eight sizes in three browsers.
- 2026-10-30, step 8: the inspector's "Level" tab made three rail tests (`DocumentScreen.dom.test.ts` ×2, `boot.dom.test.ts` ×1) find two "Level" tabs; they now query inside the rail's own tablist ("Views"), which is what they meant. 36 passed.
- 2026-10-30, step 8: `LevelView.dom.test.ts` gained the journey (place a Slime with the brush, Hit points up one, Tint to another swatch, a typed 12 refused with the max in the message and no step added, then both undone) and the shortcuts (R G E I B choose the tools, `]` and `[` the brush size, arrows and shift-arrows nudge from the canvas, `Mod+D`, `Delete` and `Mod+Z` each one step, letters ignored in a text field); 15 passed. They were written after step 8's wiring (above), so their first run passed apart from test mistakes (the inspector's tabs queried inside its own tablist, `[` escaped for user-event). Deviation: the platformer template has no `enum` field, so the journey edits an int and a colour; the enum widget is covered by `FieldEditor.dom.test.ts`. `level-view.layout.test.ts` gained the inspector (320 px in `wide`, opened from the toolbar below it), the dock (148 px under the canvas in tall `wide`, a sheet behind Levels otherwise) and the essentials (tools, Undo, Layers, Export) at the eight sizes; 147 passed in Chromium, WebKit and Firefox. Its first run failed 4 tests per browser, each fixed for the cause: (1) the dock's strip declared `data-scroll-region="inline"`, which the layout contract does not know, so a card past its side read as cut; it now declares `both`, as the shell's dock body does (a real fix in `LevelDock.svelte`); (2) the tools sit in the toolbar's declared sideways scroll region, so on a narrow canvas the later tools are reached by scrolling the row; the test scrolls each one into view and checks it lands whole without the page moving, rather than asking all six to be on screen at once; (3) at 900 x 600 the canvas is 260 px wide beside the rail, the 264 px panel and the 320 px inspector (spec §12's reference columns), under the old "a third of the window" bar; the bar is now 240 px for a `wide` window under 1000 px (decision for the Owner's veto; folding the inspector into a drawer in narrow `wide` windows would be a kit change). The rail tests' tab query now reads the "Views" tablist only.
- 2026-10-30, step 9: seven review images (1194×834, 1133×744, 834×1194 and 390×844; the inspector and the dock) from the layout test's Chromium run, with a README table, in `docs/evidence/owner-visual/2026-10-30-ed2d-4c4b/`. Nothing is selected in them, so the inspector shows its Level tab; the Entity tab is covered in jsdom. The kit counts 1133×744 as a tall `wide` height, so the dock is inline there (spec §12 calls the iPad mini short); that is the kit's height tier, left as it is. Gates after merging `origin/main`: `pnpm format` clean; the first `TURBO_FORCE=true pnpm check` failed svelte-check on a widened tuple in the new shortcut test (fixed with `as const`), then failed `tooling/api-report`'s seam test: `editor-2d.api.md` lacked the controller's new `select(ids)` (step 6), so the report is updated with `pnpm api-report --update` (one added line; the kit's exports did not change); `test:unit` 2396 passed; `test:layout` 342 passed in Chromium, WebKit and Firefox; `test:canvas` 84 passed, 12 skipped (`level-visuals.canvas.test.ts` in Chromium and WebKit, which writes review images only under `ED2D_VISUALS=1`). No changeset (private package).

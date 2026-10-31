# ED2D.5c Entities view and typed field editor: TDD plan

- **Task:** ED2D.5c in [02](../../02-master-delivery-plan.md). [2D editor spec](../specs/2026-10-23-editor-2d-design.md) §5.5 (entity definitions), §5.8 (the 5a commands, as built), §8 (the Entities row, flow 5), §12 (inputs, 44 px targets), §13, §15 G-f; mockup `entities` in `docs/design/editor-2d/screens-general.mjs`.
- **Lane:** editor-2d. **Depends on:** ED2D.5a (the commands, merged) and ED2D.4c4b (the inspector and its `FieldEditor`, merged); built on ED2D.5b's branch (#293) for `tile-sprite.ts` and the `views.ts` registration until #293 merges. **Unblocks:** ED2D.8 (journeys, the retype refusal journey).
- **Status:** drafted 2026-10-31 on `claude/ed2d-5c-entities-view`. Owner, 2026-10-30: "Auto accept all spec and plans"; this plan is accepted once its review is done.
- **Progress:** 7 of 7 steps.

## Scope

**In:** the `EntitiesView` rail destination of the `level-project` profile (it replaces the pending view for `entities`):

- **Panel:** "Definitions" with an add button, one 48 px row per entity definition (colour swatch, id, a summary such as `5 fields · rect` or `0 fields · single`); then "Level fields" (`every level`) with one row per level field (`area`, `text · default “”`) and an add button.
- **Canvas:** for a selected definition, a header (swatch, id, a pill `2 instances · 1 level`, `rect 16×24 px`, `pivot 0.5, 1`) and the preview: the shape (rect, ellipse, point or the tile's sprite) at a whole-number scale that fits, on a grid of the definition's size, the pivot marked, the width and height labelled. For "Level fields" the canvas says what level fields are and how many levels carry them.
- **Inspector:** tabs Definition and Fields (with a count badge). Definition (entity definitions only): id (rename), label, colour, shape (kit `Segmented`), width and height (`Stepper`), pivot x and y (0 to 1, step 0.5), single, tile (tileset and index, or none), Duplicate and Delete. Fields: the field list (id, type summary, `required`), add a field, and the selected field's editor: id, label, type (a chip per kit field type), list, required, default (the Level inspector's `FieldEditor` built from the field), min, max and step (int and float), options (enum, one per line), multiline (text), `to` (ref, the definition ids and `$level`), and Delete field.
- **Refusals (G-f):** deleting a definition or a field in use, and any field change that would break a value, open a dialog titled with what was asked (`Delete npc?`, `Change facing?`) listing each use (the instance and level from the use's path, and its message); "Delete anyway" or "Change anyway" applies the change and its removals as one `History` step; Cancel changes nothing.
- Every edit is one `History` step through `commitEdit`; a value the model refuses shows its message under the control and changes nothing.

**Out, with owner:**

| What                                                                              | Where                                                               |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Linking a refusal's use to its instance on the canvas (open the level, select it) | ED2D.8 (journeys); the dialog lists them                            |
| Reordering fields and definitions                                                 | not in a 5a command; a later row if wanted                          |
| Entity tags, `min` limits and `resizable` in the form                             | the model keeps them; they are not in the mockup's form (follow-up) |
| Picking a ref target on the canvas                                                | ED2D.6c                                                             |
| WebKit iPad journeys, Pencil polish                                               | ED2D.8                                                              |

## Decisions (listed in the PR for the Owner's veto)

1. **Headless first**, as 5b: `entities/entities-model.ts` turns the project and the selection into rows, the preview geometry and the field form; `entities/entities-session.ts` holds the selection and runs each edit through `commitEdit`; the Svelte files draw and forward.
2. **Guarded edits return the refusal.** A session's delete or field change returns `FieldCommit | { ok: false, uses }`; the view keeps the asked-for change and, on "anyway", calls it again with `{ anyway: true }`, which is the one step. The session never holds a pending change.
3. **Every field-definition change goes through `retypeField`** (label, list, required, default, bounds, options, multiline, `to`), and an id change through `renameField`, so one rule decides what breaks a value.
4. **Changing a field's type** keeps its id, label, list and required, and drops the settings of the old type (default, bounds, step, options, multiline, `to`); an `enum` starts with the option `a`, so the definition is valid. The values that no longer fit are the refusal's list.
5. **Selection follows the data:** the first definition and its first field on open; a removed definition or field falls back to the first remaining; "Level fields" is the owner `level`.
6. **New ids** come from the view's `IdSource` (`entity-<id>`, `field_<id>`: the kit's field ids are letters, digits and underscores). A new definition is a 16 × 16 `rect` with pivot (0.5, 1), no fields; a new field is an optional `text` with default `""`. Duplicate copies a definition under a new id, labelled `Copy of <label or id>`, with no instances.
7. **The preview** scales the shape by the largest whole number that fits the canvas (at most 8), so pixel art stays crisp; a `point` is a cross at the pivot; a `tile` shape or a definition with a `tile` draws the sprite with `tile-sprite.ts`.
8. **Use labels** come from the use's path (`levels[level-1].layers[entities].items[npc-2]` → `npc-2 in level-1`), with the path kept as the row's title.

## Contract

```ts
// app/entities/entities-model.ts
export type EntitiesOwner = "level" | { readonly entity: string };
export interface EntitiesSelection {
  owner?: EntitiesOwner;
  field?: string;
}
export function resolveSelection(
  project: Project,
  selection: EntitiesSelection,
): ResolvedEntitiesSelection;
export function definitionRows(project: Project): readonly DefinitionRow[]; // { id, label, color, summary }
export function levelFieldRows(project: Project): readonly FieldListRow[];
export function fieldRows(fields: readonly FieldDef[]): readonly FieldListRow[]; // { id, type: 'enum', summary, required }
export function fieldSummary(field: FieldDef): string; // `enum · N E S W · default S`
export function definitionPreview(
  project: Project,
  id: string,
  room: { w: number; h: number },
): DefinitionPreview;
export function withType(field: FieldDef, type: FieldType): FieldDef;
export function useLabel(path: string): string;

// app/entities/entities-session.ts
export type GuardedCommit =
  | FieldCommit
  | { readonly ok: false; readonly uses: readonly DefinitionUse[] };
export function createEntitiesSession(options: {
  history: History<unknown>;
  ids: IdSource;
}): EntitiesSession | undefined;
```

## Files

- **Create:** `packages/editor-2d/src/app/entities/entities-model.ts` (+ `.test.ts`), `entities-session.ts` (+ `.test.ts`), `EntitiesView.svelte`, `EntitiesPanel.svelte`, `DefinitionPreview.svelte`, `DefinitionForm.svelte`, `FieldsTab.svelte`, `FieldDefEditor.svelte`, `RefusalDialog.svelte`, `EntitiesView.dom.test.ts`, `entities-view.layout.test.ts`.
- **Modify:** `app/views/views.ts` (register `EntitiesView`), `app/views/views.dom.test.ts` (Entities is built).
- **Consumes:** `model/commands/entity-def-edits.ts` (`addEntityDef`, `editEntityDef`, `renameEntityDef`), `field-edits.ts` (`addField`, `retypeField`, `renameField`), `definition-uses.ts` (`deleteDefinition`), `level/field-commit.ts` (`commitEdit`), `level/inspector-model.ts` (`fieldRow`), `level/FieldEditor.svelte`, `tile-sprite.ts`, the kit's `Dialog`, `Picker`, `Segmented`, `Stepper`, `ColorField`, `Tabs`, `Button`.

## Steps

1. [x] **Rows.** `entities-model.test.ts` on the platformer and RPG templates: definition rows with summaries (`0 fields · rect · single`, `1 field · rect`), level field rows, `fieldSummary` for each type (`text · default “”`, `enum · a b · default a`, `int · 0 to 9`, `point · list`, `ref · door`, `required`), `useLabel`.
2. [x] **Selection and preview.** `resolveSelection` defaults and fallbacks (a removed definition or field); `definitionPreview`: the scale (16 × 24 in 554 × 400 is 8; 64 × 64 is 6), the pivot point in preview pixels, the instance count text (`no instances`, `1 instance · 1 level`, `2 instances · 1 level`), the tile sprite when set; `withType` drops the old type's settings and gives an enum `a`.
3. [x] **Session, definitions.** `entities-session.test.ts`: add (one step, selected), rename (instances follow), label, colour, shape, size, pivot, single, tile, duplicate; a refused value (size 0, an id in use) returns its message and adds no step; delete unused is one step without asking; delete in use returns the uses and adds no step, then `anyway` is one step that removes the instances; undo restores them and the selection falls back.
4. [x] **Session, fields.** For an entity definition and for `level`: add, rename (values move), label, required, list, default, bounds, options, type; a change that breaks values returns the uses (G-f), and `anyway` is one step; delete field in use refuses, then `anyway` is one step.
5. [x] **Views.** `EntitiesView.dom.test.ts` mounted as the app mounts it (switching the rail to Entities): the panel lists definitions and level fields; the header and preview show the selected definition; editing width updates the preview; adding a field and choosing `int` shows min, max and step; a refused default shows its message; deleting a definition in use opens the dialog listing the instances, Cancel keeps it, "Delete anyway" removes it as one undo step; changing a used field's type does the same with "Change anyway". `views.ts` registers the view. `svelte-check` clean.
6. [x] **Layout.** `entities-view.layout.test.ts` in Chromium, WebKit and Firefox at the kit's eight sizes (`SIZES`): no page scroll, every control at least 44 px, the panel and the field list scroll inside their regions, the inspector's footer and the dialog's actions stay reachable.
7. [x] **Review images** under `docs/evidence/owner-visual/2026-10-31-ed2d-5c-entities/` with a README saying what each shows and what to check.

## Gates

`pnpm format`; `TURBO_FORCE=true pnpm check`; `pnpm --filter @mcthaydt/automata-editor-2d test:parity` (all three browsers); `pnpm --filter @mcthaydt/automata-editor-2d build`. No changeset (editor-2d is private).

## Execution log

- 2026-10-31: plan drafted from the spec, the mockup and the 5a commands; read at `origin/main` 1c6b7a3f with #293's head bc367452 merged in.
- 2026-10-31: steps 1 and 2. `entities-model.test.ts` (16) failed first on the missing module, then passes. A use's path from the 5a commands ends in `.fields.<id>` for a field's value, so `useLabel` reads that form too (a case added, failing first).
- 2026-10-31: steps 3 and 4. `entities-session.test.ts` (15) failed first on the missing module; with the session written, 5 failed on the tests' own assumptions, each checked against the model: the coin is already an ellipse (the case sets `point`), the kit's field ids allow no hyphen (new fields are `field_<id>`), a refusal's paths end in `.fields.<id>`, a field's use is only a value someone chose (the fixture tints one slime by hand, so deleting `tint` lists that one), and adding a field notifies twice (history, then selection; the case asserts at least once and nothing after `stop`). Then 31 of 31 pass across both files.
- 2026-10-31: step 5. `EntitiesView.dom.test.ts` (8) failed first on the missing view (`entities-view` not found), and `views.dom.test.ts` on the unmapped `EntitiesView`. Components as built: `EntitiesView`, `EntitiesPanel`, `DefinitionPreview`, `EntityInspector` (the Definition tab and the field list; the plan's `DefinitionForm` and `FieldsTab` are this one file), `FieldDefEditor` and `RefusalDialog`. Three failures were the tests' own: the kit `Stepper` is a spinbutton until tapped, then a text box of the same name (the helper taps first); an opened document keeps definitions sorted by id, so the first is `checkpoint` and the cases choose `player-start` by name. One was the view's: the preview measured its width with `bind:clientWidth`, which needs a `ResizeObserver` (the shell's error boundary showed "The canvas stopped working" in jsdom); the room now comes from the shell mode (`wide` 420 × 300, otherwise 240 × 240), so a mode's scale is the same on every device. Then 8 of 8 and the views' 4 pass; `svelte-check --fail-on-warnings` is clean after two type fixes (a `RefValue` is `target`; the selection's optional fields take `undefined`).
- 2026-10-31: step 6. `entities-view.layout.test.ts` (4 cases × 8 sizes × 3 browsers) passed 96 of 96 on its first run, so it proves the layout holds rather than driving a change. The screenshots found two faults it does not: the width and height steppers sat in a two-column grid that wrapped each stepper's label and buttons onto two lines in the 320 px inspector, and the width label touched the pivot dot. The steppers now take a row each (as the field editor's Min, Max and Step do) and the label sits 12 px below the box; then 96 of 96 and the DOM suite's 8 still pass, `svelte-check` clean.
- 2026-10-31: step 7. Chromium-only rerun (`--project 'layout (chromium)'`, 32 of 32) for the review images; 12 images and a README in `docs/evidence/owner-visual/2026-10-31-ed2d-5c-entities/`.

## Follow-ups

- Linking a refusal's use to its instance (open the level, select it): ED2D.8.
- Entity tags, `min` limits and `resizable` are kept by the model but not in the form (the mockup leaves them out).
- Min and Max show 0 when a number field has no bound; clearing a bound needs a "none" control.
- Reordering fields and definitions has no 5a command.
- An opened document lists definitions sorted by id (the saved file's order), so a new definition appears in id order, not at the end.

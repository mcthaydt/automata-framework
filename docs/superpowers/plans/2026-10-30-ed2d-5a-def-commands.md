# ED2D.5a Definition, tileset and rule commands (headless): TDD plan

- **Task:** ED2D.5a in [02](../../02-master-delivery-plan.md), the headless first slice of ED2D.5. [2D editor spec](../specs/2026-10-23-editor-2d-design.md) §5.2 (layers), §5.4 (tilesets), §5.5 (entity definitions), §5.6 (rules), §5.8 (commands), §8 flows 5 and 6, §13 ("Deleting … in use"), acceptance G-f (retype and delete refusals; "Delete anyway" is one undo step) and the model half of G-t (from `blank`, define a layer and an entity with fields and place them). Kit spec §4.8 and EK-j, [EDK.7 plan](2026-10-23-edk-7-typed-fields.md) for `checkRetype`, `renameField` and `renameFieldValues`.
- **Lane:** editor-2d. **Depends on:** ED2D.3 and EDK.7 (merged). **Unblocks:** ED2D.5b (Tilesets view and rule editor) and ED2D.5c (Entities view and field editor), which call these through the kit's `History`.
- **Status:** implemented 2026-10-30 on `claude/editors-ed2d.5a-ed2d-5a-def-commands` (draft PR); locally checked, not CI verified. The 2D spec is drafted, not reviewed.
- **Progress:** 6 of 6 steps.

## Scope

**In:** pure functions in `packages/editor-2d/src/model/commands/`, in the ED2D.4a style: `(project, …) => Project`, the same project (`toBe`) when nothing changes, `RangeError` for a missing id (a programmer error) and for a value a person typed that the model rejects (carrying a message the view can show). Imports stay inside the `model/` and `tiles/` rules (relative paths, `zod`, the kit's `./fields`).

- **Layer definitions:** add (with an empty instance in every level, at the definition's place), reorder (definitions and every level's instances together), edit label and opacity, set an IntGrid value (add or relabel).
- **Tilesets:** add (a placeholder or an image), import an image (swaps `image` and `imageSize`, keeps every tile index), tag and untag tiles.
- **Rule groups and rules** on an auto layer: add, edit (label, active), reorder and delete a group; add, edit (outputs, chance, flips, break, outside, active), resize the pattern, set one pattern cell, reorder and delete a rule; `nextPatternCell`, the tap cycle any → empty → filled → is → not → any.
- **Entity definitions:** add, edit what does not touch instances (label, colour, shape, size, pivot, tile, tags, min), rename the id (instances and every ref field's `to` follow).
- **Fields** of an entity definition or of the levels: add (existing instances get the field's stand-in value), rename (values move with it), retype (any change of the field definition, through the kit's `checkRetype`), delete.
- **Uses and the refusal:** `definitionUses(project, ref)` lists what a delete would remove; `deleteDefinition(project, ref, { anyway })` and `retypeField(…, { anyway })` refuse with that list unless `anyway`, and with it remove the uses in the same returned project, so "Delete anyway" is one `History.apply`, one undo step.

**Out, with owner:**

| What | Where |
|---|---|
| The Tilesets view, the pattern editor, the live preview, reorder by grip | ED2D.5b |
| The Entities view, the field editor form, the refusal dialog | ED2D.5c |
| Deleting a tileset or an IntGrid value, changing a layer's grid, tileset or source, changing an entity's `single` or `resizable`, moving a rule between groups, reordering fields | not in the 5a row; a later row adds them with their own uses |
| `rerollSeed`, level and world commands | ED2D.6 |
| Applying a Checks fix | ED2D.7 |

## Decisions (the spec's defaults where it has one; listed in the PR for the Owner's veto)

1. **A refusal is a value, not a throw.** `retypeField` and `deleteDefinition` return `{ ok: true, project } | { ok: false, uses }`. A use is `{ path, message }`, the path spelled as the Checks spell it (`levels[level-1].layers[entities].items[slime-1]`), so the dialog lists the exact instances and links them. With `{ anyway: true }` the same call returns `ok: true` and the project with the uses removed.
2. **What a use is.** An entity definition: each of its instances. A field (of an entity or of the levels): each instance or level that holds a value for it. A layer definition: each level whose instance of it holds cells, overrides or items, and each auto layer that reads it; "anyway" removes the layer, its instances and those auto layers. A ref that pointed at a removed instance is not a use: it becomes `brokenRef` in the Checks, which link it.
3. **A forced retype** drops each broken value and gives the instance the new field's stand-in (`valuesWithDefaults`): its default or its type's zero, nothing for a required field without a default, which the Checks then report as `fieldMissing`. Values that still validate are kept. A retype whose new definition fails `checkFieldDef`, or whose new id is taken, throws `RangeError` with the kit's message.
4. **Rename is a retype that changes only the id**, so it never refuses; renaming an entity definition updates every instance's `def` and every ref field's `to` that names it. Deleting an entity definition leaves a `to` that names it alone (removing the last name would widen the field to "any").
5. **The editor never writes what the Checks flag:** a tile beyond its tileset (rule outputs, tags, an entity's tile), a pattern or `outside` value the source layer does not define, a field definition the kit rejects, a duplicate id, a layer grid that makes a level wider than 1024 cells, a tileset or source that does not exist. Shapes are validated by the project schema's own `layerDefSchema`, `tilesetDefSchema`, `entityDef2DSchema` and the rule schema, now exported from `project.schema.ts` (one contract owner).
6. **The pattern cycle** takes the IntGrid value the person has selected: any → empty → filled → `{ is: value }` → `{ not: value }` → any. A new rule is 3 × 3 of `any` with a `filled` centre, no tiles, chance 1, no flips, `breakOnMatch: true` and `outside: 'same'`, as the templates' terrain rules are; resizing keeps the centred cells and pads with `any`.
7. **New things go at the end** (a layer at the back of the list, a rule at the end of its group) unless an index is given; a group or rule id is minted by the caller's `IdSource`, as instance ids are.
8. **Tags:** tiles in a tag are kept sorted and unique; untagging the last tile drops the tag.

## Contract

```ts
// model/commands/definition-uses.ts
export type FieldOwner = 'level' | { readonly entity: string }
export type DefinitionRef =
  | { readonly kind: 'layer'; readonly id: string }
  | { readonly kind: 'entity'; readonly id: string }
  | { readonly kind: 'field'; readonly owner: FieldOwner; readonly id: string }
export interface DefinitionUse { readonly path: string; readonly message: string }
export type GuardedEdit = { readonly ok: true; readonly project: Project } | { readonly ok: false; readonly uses: readonly DefinitionUse[] }
export function definitionUses(project: Project, ref: DefinitionRef): readonly DefinitionUse[]
export function deleteDefinition(project: Project, ref: DefinitionRef, options?: { readonly anyway?: boolean }): GuardedEdit

// model/commands/layer-def-edits.ts
export function addLayerDef(project: Project, def: LayerDef, at?: number): Project
export function reorderLayerDefs(project: Project, from: number, to: number): Project
export function editLayerDef(project: Project, id: string, patch: { readonly label?: string; readonly opacity?: number }): Project
export function setIntValue(project: Project, layer: string, value: IntValueDef): Project

// model/commands/tileset-edits.ts
export function addTileset(project: Project, def: TilesetDef): Project
export function importTileset(project: Project, id: string, image: { readonly path: string; readonly size: Size }): Project
export function tagTiles(project: Project, tileset: string, tag: string, tiles: readonly number[]): Project
export function untagTiles(project: Project, tileset: string, tag: string, tiles: readonly number[]): Project

// model/commands/rule-edits.ts
export function nextPatternCell(cell: PatternCell, value: number): PatternCell
export function newRule(id: string): Rule
export function addRuleGroup(project: Project, layer: string, group: { readonly id: string; readonly label: string }): Project
export function editRuleGroup(project: Project, layer: string, group: string, patch: { readonly label?: string; readonly active?: boolean }): Project
export function reorderRuleGroups(project: Project, layer: string, from: number, to: number): Project
export function deleteRuleGroup(project: Project, layer: string, group: string): Project
export function addRule(project: Project, layer: string, group: string, rule: Rule, at?: number): Project
export function editRule(project: Project, layer: string, rule: string, patch: RulePatch): Project
export function resizeRule(project: Project, layer: string, rule: string, size: 1 | 3 | 5): Project
export function setPatternCell(project: Project, layer: string, rule: string, index: number, cell: PatternCell): Project
export function reorderRules(project: Project, layer: string, group: string, from: number, to: number): Project
export function deleteRule(project: Project, layer: string, rule: string): Project

// model/commands/entity-def-edits.ts
export function addEntityDef(project: Project, def: EntityDef2D): Project
export function editEntityDef(project: Project, id: string, patch: EntityDefPatch): Project
export function renameEntityDef(project: Project, from: string, to: string): Project

// model/commands/field-edits.ts
export function addField(project: Project, owner: FieldOwner, def: FieldDef): Project
export function retypeField(project: Project, owner: FieldOwner, id: string, next: FieldDef, options?: { readonly anyway?: boolean }): GuardedEdit
export function renameField(project: Project, owner: FieldOwner, from: string, to: string): Project
```

Field deletion is `deleteDefinition(project, { kind: 'field', owner, id })`.

## Files

- Create in `packages/editor-2d/src/model/commands/`: `definition-uses.ts`, `layer-def-edits.ts`, `tileset-edits.ts`, `rule-edits.ts`, `entity-def-edits.ts`, `field-edits.ts`, each with a `.test.ts`; `def-lookup.ts` (shared finders, the schema check, `moveItem`, `DefinitionUse`, `GuardedEdit`) and `field-owner.ts` (`FieldOwner` and the holders of a field's values), covered through the suites that use them.
- Modify: `model/project.schema.ts` (export `layerDefSchema`, `tilesetDefSchema`, `entityDef2DSchema`), `model/project-codec.ts` (export `MAX_LAYER_CELLS`), `src/index.ts` and `index.test.ts` (export the commands), the 2D spec §5.8 (an "As built (ED2D.5a)" paragraph).
- Fixtures: the `blank`, platformer and top-down RPG templates built with `counterIds`, and `testing/project-edit.ts`. Each suite checks that an edit on a valid project adds no Checks error (`checkProject`).

## Steps

Each step starts with a failing test and its reason (the module or export does not exist). After each: the file's tests, the package `typecheck`.

- [x] **1. Shared lookup and layer definitions.** `addLayerDef` gives every level an empty instance at the same index, refuses a bad shape (schema), a taken id, a missing tileset, an auto source that is not an IntGrid layer, a grid that makes a level wider than 1024 cells and more than 64 layers; `reorderLayerDefs` moves the definition and each level's instance, same index is `toBe`, an index out of range throws; `editLayerDef` changes label and opacity, refuses opacity on an entities layer and outside 0..1, the same values are `toBe`; `setIntValue` adds a value, relabels and recolours one by number, refuses an id another value has. No new Checks error after each.
- [x] **2. Tilesets.** `addTileset` (placeholder and with an image), refuses a taken id and a bad shape; `importTileset` swaps image and size and keeps tile indices; `tagTiles` creates a tag, merges sorted and unique, refuses a tile beyond the tileset; `untagTiles` removes and drops an emptied tag; no-ops are `toBe`.
- [x] **3. Rules.** `nextPatternCell` cycles all five, `newRule` matches the schema; groups add, edit, reorder, delete; rules add (at an index too), refuse a taken id, a tile beyond the tileset, an unknown `is` or `not` value, an unknown `outside`; `editRule` changes outputs, chance, flips, break and active, refuses chance outside 0..1; `resizeRule` keeps the centre; `setPatternCell` checks the index and the value; `reorderRules`, `deleteRule`; every command throws for an unknown layer, a non-auto layer, a group or a rule.
- [x] **4. Entity definitions and fields.** `addEntityDef` (kit `checkEntityDef` refusals, a taken id, a missing tile tileset), `editEntityDef`, `renameEntityDef` (instances and `to` follow); `addField` (stand-in values on existing instances; a level field on every level), `renameField` keeps values, `retypeField` (EK-j on the platformer: `hp` int to text with two instances holding numbers refuses with exactly those two; a compatible change passes; `anyway` drops the broken values and gives the stand-in; a bad new definition throws).
- [x] **5. Uses and delete.** `definitionUses` for an entity, a field, a level field and a layer (cells, items, an auto layer that reads it); `deleteDefinition` refuses with the list, deletes an unused definition without asking, and with `anyway` removes the uses; through `createFakeHistory` it is one step whose undo is the project before (G-f); G-t: from `blank`, add an IntGrid layer, an entity definition with fields and place an instance with no Checks error.
- [x] **6. Exports and gates.** `index.test.ts` lists the new names; spec §5.8 "As built"; `pnpm format`, `TURBO_FORCE=true pnpm check`, changeset status and `check-changesets`.

## Gates

Focused: `pnpm --filter @mcthaydt/automata-editor-2d exec vitest run src/model/commands`; package `typecheck`. Full: `pnpm format`, `TURBO_FORCE=true pnpm check`, `pnpm changeset status --since=origin/main`, `node tooling/release/src/check-changesets.ts`. Not run: parity, layout and visual suites (no hashes, no screens; this slice adds no cross-engine behaviour), CI.

## Execution record

- **Steps 1 to 3** (layer definitions, tilesets, rules): 20, 13 and 25 tests. Deviation: `rule-edits.ts` was written in step 1, because `addLayerDef` checks a new auto layer's groups with its `checkGroups`; its own tests came in step 3. The step 1 and 2 implementations were written right after their tests, before the first failing run was recorded; the mutation pass below stands in for that evidence.
- **Steps 4 and 5** (fields, entity definitions, uses and delete): 15, 10 and 15 tests, each suite run red first (module missing). `field-owner.ts` is a seventh file the plan did not name (shared by the field edits and the delete refusals); `DefinitionUse` and `GuardedEdit` live in `def-lookup.ts`.
- **Mutation pass** (21 hand mutants over the seven files, each against its suite): 15 killed at first; 5 survivors got tests (an IntGrid value whose label alone changes, a rule whose `flipY` alone changes, a level field's `to` on `renameEntityDef`, an auto layer's overrides as content, a stray value on another definition's instance) and were then killed; 1 is equivalent (`if (def.kind === 'objects') return` in `addLayerDef`: an objects layer has no grid, so the cell check compares `NaN` and never throws; the guard is there for the reader and for TypeScript).
- **Step 6:** exports in `src/index.ts`, `index.test.ts` lists them; spec §5.8 "As built (ED2D.5a)". Gates below.

# ED2D.4a Level edit commands: TDD plan

- **Task:** ED2D.4a, the headless first slice of ED2D.4 in [02](../../02-master-delivery-plan.md). [2D editor spec](../specs/2026-10-23-editor-2d-design.md) §5.8 (commands), §5.9 (tools), §9 (the entity checks these commands must never trip), acceptance G-b and G-c (a stroke is one undo step; an invalid value is refused).
- **Lane:** editor-2d. **Depends on:** ED2D.1 (model), ED2D.2 (the cell operations) and ED2D.3 (`emptyLayers`, the checks and the samples these tests build on); this PR stacks on #132. **Unblocks:** ED2D.4b (the Level view controller and the app call these as `History` updates).
- **Status:** Implemented 2026-10-23 on `claude/project-thread-73sp69-ed2d4a` (draft PR stacked on #132). The 2D spec is drafted, not reviewed.
- **Progress:** 4 of 4 steps; implemented and locally checked, not CI verified.

## Why a slice of its own

ED2D.4 is the editor's first screen: the app shell, Home, the layer panel, the palettes, the Pixi canvas, the tools and the inspector. All of that calls the same few project edits, and none of it can be tested before they exist. Writing them first, headless and with exact tests, keeps the Svelte and Pixi work (ED2D.4b onward) to wiring. The row stays one row in 02; this plan is its first PR.

## Scope

**In:** pure functions in `packages/editor-2d/src/model/commands/`, each `(project, …) => Project`, importing only relative paths, `zod` and the kit's `./fields` entry (the `architecture.test.ts` rules for `model/`):

- **Cell edits** on the four layer kinds that hold cells (tiles and IntGrid `cells`, an auto layer's `overrides`): paint cells, paint a rectangle, flood fill, erase, the dice, paste a stamp. They validate the word against the layer (an IntGrid value the layer defines, a tile inside the layer's tileset) so the editor cannot write what the Checks would then flag.
- **Entity edits:** place (with the definition's defaults), move, resize, set a field, delete, duplicate; and the geometry the canvas and the select tool share: an instance's bounds from its definition's shape, size, pivot and own `w`/`h`, and a hit test that picks the topmost instance at a point.
- **Object edits:** place, move, flip, delete.

**Out, with owner:**

| What | Where |
|---|---|
| The tool controller (pointer events to strokes and drags, one `History` transaction each), tool state, the palette selection | ED2D.4b |
| Svelte views, the Pixi canvas, Home, the app shell | ED2D.4b to ED2D.4d |
| Level and world commands (`addLevel`, `resizeLevel`, `moveLevelInWorld`, `setWorldLayout`) | ED2D.6 |
| Definition commands (`addLayerDef`, `addEntityDef`, `retypeField`, `deleteDefinition`, rule and tileset edits) | ED2D.5 |
| Applying a Checks fix | ED2D.7 |

## Decisions made here (written into the 2D spec in this PR)

1. **A command is a pure function that returns the next project.** It returns the same object (`toBe`) when nothing changed, so `History.apply` records nothing for a stroke that repaints what was already there. A missing level, layer or instance, or a layer of the wrong kind, is a programmer error and throws `RangeError` with the ids in the message; nothing a person does through the UI reaches it.
2. **A layer is addressed by `{ level, layer }`**, the level's `id` and the layer definition's `id`. One helper, `updateLayer`, finds it, applies an edit and rebuilds the path, so every command shares one lookup and one error.
3. **A word is validated against its layer.** On an IntGrid layer, 0 (erase) or a value in the layer definition's `values`; on a tiles layer or an auto layer's overrides, 0 or a packed tile whose index is below `tilesetTiles(tileset).count` (flips are free). A bad word throws `RangeError`. This keeps the editor from producing `cellValueUnknown` and `tileOutOfRange`.
4. **The dice take their candidates as words** (the palette's selection, flips included) and the layer's `seed` is not used: the stroke's seed is the caller's, because a stroke repainted on redo must give the same tiles, and the controller keeps one seed per stroke.
5. **Placing a `single` definition again moves the instance that is already in the level** to the new position instead of refusing, so the tool never has to explain; the command returns the same id. Otherwise `placeEntity` appends an instance with the id it is given (the controller mints it from the `IdSource`, so it can select the instance it placed), the definition's default field values and, for a resizable definition, `w` and `h` set to the definition's size.
6. **Entity position is the pivot point** in level pixels, as `EntityInstance.x/y` is stored. Bounds are `[x - pivot.x * w, y - pivot.y * h]` to `+ (w, h)` with `w`/`h` the instance's or else the definition's size; a `point` shape has bounds of its definition's size too, so it can be hit. The hit test picks the last item (drawn on top) whose bounds contain the point, and ignores a layer that is not an entities layer.
7. **`setEntityField` validates with the kit's `checkFieldValue`** against the definition's field and throws `RangeError` carrying the problem's message when the value is invalid, so a bad value never lands (G-c); the inspector shows the message and keeps the old value. Setting a field the definition does not have is a `RangeError` too.
8. **Snapping belongs to the controller**, not the commands: a command stores the position it is given (after `Math.round`, since positions are whole pixels in the file).
9. **`duplicateEntity` takes the new id and an offset** and copies the field values; for a `single` definition it throws (the controller disables Duplicate for it).

## Contract

```ts
// model/commands/layer-target.ts
export interface LayerTarget { readonly level: string; readonly layer: string }
export function updateLayer(project: Project, target: LayerTarget, edit: (layer: LayerInstance, def: LayerDef) => LayerInstance): Project

// model/commands/cell-edits.ts
export function paintLayerCells(project: Project, target: LayerTarget, cells: Iterable<Point>, word: number): Project
export function paintLayerRect(project: Project, target: LayerTarget, a: Point, b: Point, word: number): Project
export function fillLayer(project: Project, target: LayerTarget, at: Point, word: number): Project
export function eraseLayerCells(project: Project, target: LayerTarget, cells: Iterable<Point>): Project
export function paintLayerRandom(project: Project, target: LayerTarget, cells: Iterable<Point>, candidates: readonly number[], seed: number): Project
export function pasteLayerStamp(project: Project, target: LayerTarget, stamp: Stamp, at: Point, options?: { clear?: boolean }): Project

// model/commands/entity-edits.ts
export function placeEntity(project: Project, target: LayerTarget, input: { id: string; def: string; x: number; y: number }): Project
export function moveEntity(project: Project, target: LayerTarget, id: string, x: number, y: number): Project
export function resizeEntity(project: Project, target: LayerTarget, id: string, w: number, h: number): Project
export function setEntityField(project: Project, target: LayerTarget, id: string, field: string, value: FieldValue): Project
export function deleteEntity(project: Project, target: LayerTarget, id: string): Project
export function duplicateEntity(project: Project, target: LayerTarget, id: string, copyId: string, offset: Point): Project

// model/commands/entity-geometry.ts
export interface Bounds { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
export function entityBounds(def: EntityDef2D, instance: EntityInstance): Bounds
export function entityAt(project: Project, target: LayerTarget, at: Point): EntityInstance | undefined

// model/commands/object-edits.ts
export function placeObject(project: Project, target: LayerTarget, input: { id: string; tile: number; x: number; y: number; flipX?: boolean; flipY?: boolean }): Project
export function moveObject(project: Project, target: LayerTarget, id: string, x: number, y: number): Project
export function flipObject(project: Project, target: LayerTarget, id: string, axis: 'x' | 'y'): Project
export function deleteObject(project: Project, target: LayerTarget, id: string): Project
```

`Point` is `tiles/footprint.ts`'s `{ x, y }`; `Stamp` is `tiles/stamp.ts`'s. Cells are grid cells; entity and object positions are level pixels.

## Files

- Create: `packages/editor-2d/src/model/commands/{layer-target,cell-edits,entity-edits,entity-geometry,object-edits}.ts` and a `.test.ts` for each.
- Create: `packages/editor-2d/src/testing/edit-fixtures.ts` if the three suites need a shared starter project (the Mossgate sample and a one-level platformer built with `counterIds` are already in `testing/samples.ts` and `profiles/level-project/templates`).
- Modify: `packages/editor-2d/src/index.ts` (export the commands), `index.test.ts`, `docs/02-master-delivery-plan.md` (ED2D.4 row status), `docs/03-continuation-prompt.md`, the 2D spec §5.8 and §5.9 (the as-built decisions above).
- Test only through the public function of each file; fixtures come from the platformer and RPG templates and the samples, so an edit's effect is shown on a project that already passes the Checks.

## Steps

Each step starts with a failing test and the reason it fails. After each: the package's `typecheck` and `test:unit`, then a hand mutation pass on the new file (mutate one condition or constant at a time, run that file's tests, restore; every survivor gets a test or a reason it is equivalent).

- [x] **1. Layer lookup and cell edits.** Fails: the module does not exist. `updateLayer` rebuilds the project with one layer changed, leaves every other level and layer `toBe` the same object, throws `RangeError` naming the missing level or layer, and returns the same project when the edit returns the same layer. Cell edits on the platformer template's `collision` (IntGrid), `decor` (tiles) and `ground` (auto, so `overrides`): painting a footprint changes exactly those cells and shares the untouched chunks; painting the word a cell already holds returns the same project; erase writes 0; a rectangle in either corner order; a fill stays inside the level and replaces equal words only; the dice repeat for the same seed and cells in any order; a stamp skips its empty cells unless `clear`; cells outside the level are dropped; an IntGrid value the layer does not define, and a tile index beyond the tileset, throw `RangeError`; flips pass; an entities layer and an objects layer throw `RangeError` ("has no cells").
- [x] **2. Entity geometry and edits.** Fails: not exported. `entityBounds` for each shape and pivot (a `rect` with pivot 0.5, a `point`, a resizable instance with its own `w`/`h`); `entityAt` picks the topmost of two overlapping instances, none at an empty point, and the boundary is inclusive on the top-left edge and exclusive on the bottom-right; `placeEntity` appends an instance with the definition's defaults (`valuesWithDefaults`) and, when resizable, `w`/`h` from the definition's size; a `single` definition placed twice moves the first and keeps one instance and its id; `moveEntity` rounds to whole pixels; `resizeEntity` refuses a definition that is not resizable on that axis (`resizable: 'x'` refuses a changed `h`) and a size below 1; `setEntityField` stores a valid value, throws with the kit's message for a wrong type, an out-of-range number, a bad enum option and an unknown field, and leaves the project untouched; `deleteEntity`; `duplicateEntity` copies the fields, offsets the position, keeps the original, and throws for a `single` definition; every command throws `RangeError` for an unknown instance id. The Checks (`checkProject`) report no new diagnostic after each edit on a valid project, except that placing a definition with a required field and no default (a door) adds exactly its `fieldMissing`, which is the inspector's cue.
- [x] **3. Object edits.** Fails: not exported. `placeObject` appends with the flips defaulting to false and refuses a tile beyond the layer's tileset; `moveObject` rounds; `flipObject` toggles one axis and twice is the identity; `deleteObject`; unknown id and wrong layer kind throw `RangeError`.
- [x] **4. Exports and gates.** Fails: `index.test.ts` lists the new names. Export the commands from `src/index.ts`; amend spec §5.8 and §5.9 with the decisions; update the 02 row and 03; `pnpm lint`, `style`, `knip`, `boundaries` clean; the package's `typecheck`, `test:unit` and the browsers (`test:parity`) projects green in Chromium; `pnpm api-report --update` if the package has a report (the package is private, so it has none).

## Gates

`pnpm --filter @mcthaydt/automata-editor-2d typecheck` and `test:unit`; repo-level `pnpm lint`, `style`, `knip`, `boundaries`. Not run here: CI, WebKit and Firefox parity (the commands add no hashes and no new cross-engine behavior), the full-repo `test:unit` (run once before the PR leaves draft), any visual check (no screens).

## Execution record

- **Step 1:** `updateLayer`, `findLayer`, six cell edits, word validation. 31 tests (8 for the lookup, 23 for the cell edits). 18 mutants on `cell-edits.ts` and 5 on `layer-target.ts`: 3 survived at first (an auto layer's overrides were not checked against the tileset, a missing tileset was not refused, a layer present in a level but missing from the definitions was not refused); each got a test and was killed. One guard (`def.kind` narrowing inside `checkWord`) was dead code, so it became an `else if`.
- **Step 2:** `entity-geometry.ts` and `entity-edits.ts`. 36 tests for edits and 13 for geometry. 33 mutants on the edits: 3 survived (an object using an id was not refused, moving along one axis alone was not tested, `setEntityField` replacing all fields); all closed. 11 mutants on the geometry, all killed.
- **Step 3:** `object-edits.ts` (17 tests) and `pixels.ts` (`wholePixels`, shared by entity and object edits, 2 tests). 20 mutants on the object edits: 3 survived at first (flip y twice, the wrong-layer-kind errors of move, flip and delete, and a missing tileset), closed with tests; one remaining is equivalent (`layer.kind !== 'objects' ||` in `placeObject` is implied by `def.kind` in a valid project and is there for TypeScript's narrowing).
- **Step 4:** the commands are exported from `src/index.ts`, spec §5.8 has an "As built" paragraph, and the 02 and 03 rows are updated.
- **Deviations from the plan:** `findLayer` is exported next to `updateLayer` (the geometry reads a layer without editing it), `idInUse` lives in `layer-target.ts` and checks entities and objects across the whole project, and `placeObject` is refused for a layer that is not an objects layer with the same message as the other object edits. `placeEntity` on a `single` definition looks in every entities layer of the level, not only the target one.
- **Evidence (local, Node 24):** `editor-2d` 598 unit tests (99 new in `model/commands`), `tsc -p .` clean, `pnpm lint` exit 0, `pnpm style` 0 findings, `pnpm knip` clean, `pnpm boundaries` 0 findings.
- **Not run:** CI; Chromium, WebKit and Firefox parity (no new hashes or cross-engine behavior); the full-repo `test:unit`; any visual check (no screens). No Owner acceptance.

# ED2D.6a World and level commands (headless): TDD plan

- **Task:** ED2D.6a, the headless first slice of ED2D.6 in [02](../../02-master-delivery-plan.md). [2D editor spec](../specs/2026-10-23-editor-2d-design.md) §5.1 (worlds, levels, placements), §5.7 (layouts, neighbours), §5.8 (`addLevel`, `duplicateLevel`, `resizeLevel(anchor)`, `moveLevelInWorld`, `setWorldLayout`), §6.2 (`world.toml` neighbours), §9 (`entityOutOfBounds`, `levelOutsideWorld`), §13 (a level resized smaller than its content), acceptance G-h (the model half: positions snap, neighbours appear in the export, undo restores).
- **Lane:** editor-2d. **Depends on:** ED2D.3 (merged: the export, its neighbours, the checks and the templates these tests build on). **Unblocks:** ED2D.6b (the World view calls these as `History` updates).
- **Status:** Implemented 2026-10-30 on `claude/editors-ed2d.6a-ed2d-6a-world-commands` (draft PR). The 2D spec is drafted, not reviewed.
- **Progress:** 6 of 6 steps; implemented and locally checked, not CI verified.

## Scope

**In:** pure functions in `packages/editor-2d/src/model/world/`, each `(project, …) => Project`, following the ED2D.4a command rules (the same object back when nothing changes, `RangeError` for a missing id or a value the model refuses), importing only relative paths, `zod` and the kit's `./fields` entry (the `architecture.test.ts` rules for `model/`):

- **Levels:** add (empty layers from the definitions, the level fields' defaults), remove (with its placements), duplicate (fresh instance ids from the injected `IdSource`), set a level field (validated by the kit), set a level's depth.
- **Placement:** move a level in its world, place a level in a world (moving it out of any other), with the world's layout applied: `free` whole pixels, `grid` snapped to the world's grid, `horizontal`/`vertical` a sequence whose positions are derived.
- **Layout:** switch a world between `free`, `grid`, `horizontal` and `vertical`; switching to `grid` snaps every placement; never changes a level's contents.
- **Resize:** resize a level about an anchor; the tile, IntGrid and auto-override cells that fall outside are dropped and `resizeLevelLoss` lists them per layer for the confirm dialog; entities and objects are kept (and the Checks flag `entityOutOfBounds`).
- **Neighbours:** the export's neighbour rule moves from `profiles/level-project/content-world.ts` to `model/world/world-neighbours.ts`, so the export and the World view share one owner (the profile may import the model; the model may not import a profile).

**Out, with owner:**

| What | Where |
|---|---|
| The World view (Pixi rectangles, drag, the layout switch, the inspector), the confirm dialog | ED2D.6b |
| Reference fields that pick targets in other levels, links on the canvas and the map | ED2D.6c |
| Adding, renaming or removing worlds; level name and background edits | ED2D.6b, when the inspector needs them |
| Applying a Checks fix (`move-inside`) | ED2D.7 |

## Decisions made here (defaults the Owner can veto)

1. **A linear world's order is its placements' order.** `horizontal` lays the levels left to right from x = 0 at y = 0, touching; `vertical` top to bottom from y = 0 at x = 0. Switching to a linear layout first sorts the placements by their position along the axis (then the other axis, then id); moving a level in a linear world reinserts it where its centre falls among the others' centres. Depth is kept.
2. **Grid snapping rounds to the nearest grid point** (`Math.round(x / grid.w) * grid.w`). Switching to `grid` without a grid size uses the largest cell size of the layer definitions (so every layer's cells line up across levels), else 16 px; switching away from `grid` drops the grid (the schema's rule) and keeps the positions.
3. **Resize keeps the content where it is in the world.** The anchor is `{ x: 'start' | 'centre' | 'end', y: … }`, the side (or the middle) that stays put. The content moves inside the level by the size change on that axis (`end`) or half of it (`centre`), rounded toward zero to a multiple of every cell layer's grid so cells stay cells, and the level's placement moves the opposite way, so nothing jumps on the map (then the world's layout applies again).
4. **A size the guard rails refuse throws** (`RangeError`): 1 to 16 384 px a side and at most 1024 cells a side on every cell layer (ED2D-D13), and at most 256 levels on `addLevel`/`duplicateLevel`.
5. **Duplicating a level remaps references inside the copy:** a ref in the copy that names an instance of the original level names that instance's copy, and a `container` naming the original level names the copy. Refs elsewhere are untouched. The copy goes right after the original (to its right in `free` and `grid`, next in a linear sequence) in the original's world, at its depth.
6. **`addLevel` takes the size and an optional background** (default black, `fit`) from the caller; the view chooses (the selected level's size).
7. **Removing a level leaves references to it broken**, for the Checks to report (`brokenRef`, G-g); the command does not cascade.

## Contract

```ts
// model/world/world-neighbours.ts (moved from profiles/level-project/content-world.ts)
export interface LevelNeighbours { readonly level: string; readonly north: readonly string[]; readonly east: …; readonly south: …; readonly west: … }
export function worldNeighbours(project: Project, world: World): LevelNeighbours[]

// model/world/world-layout.ts
export function setWorldLayout(project: Project, world: string, layout: WorldLayout, grid?: Size): Project

// model/world/level-placement.ts
export function moveLevelInWorld(project: Project, level: string, x: number, y: number): Project
export function placeLevel(project: Project, level: string, world: string, at: Point): Project
export function setLevelDepth(project: Project, level: string, depth: number): Project

// model/world/level-edits.ts
export interface NewLevel { readonly id: string; readonly name: string; readonly world: string; readonly x: number; readonly y: number; readonly size: Size; readonly background?: Background }
export function addLevel(project: Project, input: NewLevel): Project
export function removeLevel(project: Project, level: string): Project
export function duplicateLevel(project: Project, level: string, copy: { readonly id: string; readonly name: string }, ids: IdSource): Project
export function setLevelField(project: Project, level: string, field: string, value: FieldValue): Project

// model/world/level-resize.ts
export interface ResizeAnchor { readonly x: 'start' | 'centre' | 'end'; readonly y: 'start' | 'centre' | 'end' }
export interface DroppedCells { readonly layer: string; readonly count: number }
export function resizeLevelLoss(project: Project, level: string, size: Size, anchor: ResizeAnchor): DroppedCells[]
export function resizeLevel(project: Project, level: string, size: Size, anchor: ResizeAnchor): Project
```

## Files

- Create: `packages/editor-2d/src/model/world/{world-neighbours,world-layout,level-placement,level-edits,level-resize}.ts` and a `.test.ts` for each.
- Delete: `packages/editor-2d/src/profiles/level-project/content-world.ts` (its test, which reads the neighbours through the export, stays and keeps passing).
- Modify: `profiles/level-project/content-export.ts` (import `worldNeighbours` from the model), `src/index.ts` and `index.test.ts` (export the commands), the 2D spec §5.7 (an "As built" paragraph with the decisions above).
- Fixtures: the platformer and RPG templates and `testing/project-edit.ts`, so every edit is shown on a project that already passes the Checks.

## Steps

Each step starts with a failing test and the reason it fails; after each, the package's `typecheck` and the new file's tests, then a hand mutation pass on the new file.

- [x] **1. Neighbours in the model.** Fails: `model/world/world-neighbours` does not exist. The cases of `content-world.test.ts` against `worldNeighbours` directly (touching sides, a corner is not a neighbour, ordering, a missing level skipped); then the export imports it and `content-world.ts` goes; `content-world.test.ts` still passes unchanged.
- [x] **2. Layout.** Fails: not exported. Free to grid snaps each placement to the nearest grid point (G-h: positions snap, neighbours appear in the export); the grid defaults to the largest layer grid; grid to free drops the grid and keeps positions; horizontal and vertical sort by position and lay the levels end to end; switching never touches a level; switching to the layout it has with the same grid returns the same project; a grid of a different size re-snaps; an unknown world throws; undo restores (the old project is unchanged).
- [x] **3. Placement and depth.** Fails: not exported. `moveLevelInWorld` rounds in a free world, snaps in a grid world, reorders in a linear world by the centre, returns the same project for no change, throws for an unplaced or unknown level; `placeLevel` moves a level from one world to another (clearing a double placement), applying the target's layout, and fixes `levelOutsideWorld`; `setLevelDepth` stores a whole depth and refuses a fraction.
- [x] **4. Level edits.** Fails: not exported. `addLevel` adds a level with an instance of every layer definition and the level fields' defaults, places it (snapped, or at the end of a sequence), and the project passes the Checks with no new error; refuses a bad id, a duplicate id, a size past the guard rails and a 257th level; `removeLevel` removes the level and its placements and leaves references broken (`brokenRef`); `duplicateLevel` copies cells and items with fresh ids, remaps refs inside the copy, places the copy after the original and passes the Checks; `setLevelField` validates with the kit and refuses an unknown field.
- [x] **5. Resize.** Fails: not exported. Growing keeps every cell; shrinking from the `start` anchor drops the cells beyond the new size and `resizeLevelLoss` lists their count per layer (tiles, IntGrid and auto overrides; none for entities and objects); an `end` or `centre` anchor moves the content and the placement the opposite way, so world positions stay; entities outside are kept and `entityOutOfBounds` appears; the same size returns the same project; the guard rails throw.
- [x] **6. Exports and gates.** Fails: `index.test.ts` lists the new names. Export from `src/index.ts`; amend spec §5.7; `pnpm format`, `TURBO_FORCE=true pnpm check`, `pnpm changeset status --since=origin/main`, `check-changesets`.

## Gates

`pnpm --filter @mcthaydt/automata-editor-2d typecheck` and the focused tests per step; at the end `pnpm format` and `TURBO_FORCE=true pnpm check` (lint, typecheck, boundaries, style, knip, unit). Not run here: CI, the browser projects (no DOM, no hashes, no cross-engine behavior), any visual check (no screens).

## Execution record

- **Step 1:** `worldNeighbours` moved to `model/world/world-neighbours.ts` (`git mv` of `content-world.ts`, renamed from `neighboursOf`, with its own `LevelNeighbours` type, structurally the export's `ContentNeighbours`); `content-export.ts` imports it. 5 new tests; `content-world.test.ts` unchanged and passing.
- **Step 2:** `world-layout.ts` (`setWorldLayout` plus the shared `findWorld`, `replaceWorld`, `snapPosition`, `arrangeWorld`). 15 tests.
- **Step 3:** `level-placement.ts`. 17 tests.
- **Step 4:** `level-edits.ts` (`checkLevelSize` shared with the resize). 20 tests.
- **Step 5:** `level-resize.ts`. 16 tests.
- **Step 6:** exported from `src/index.ts` (one block, after `tileset-grid`), `index.test.ts` lists them; spec §5.7 has an "As built" paragraph; `pnpm api-report --update` rewrote `tooling/api-report/reports/editor-2d.api.md` (the package has a report after all).
- **Mutation pass:** 34 hand mutants across the four command files (scripted: one replacement at a time, the folder's tests run, the file restored). 10 survived the first round: a grid change on one axis only, centre vs left edge in a sequence, a move along y only, the row half of the cell limit, a source repeating an id, a level field's ref, the copy's depth, `trunc` vs `round`, a resize that moves on one axis only, and a size change on one axis only; each got a test and all 10 were killed in the second round. One was equivalent (`samePlacements` comparing depth, which `moveLevelInWorld` never changes) and the clause was removed.
- **Deviations from the plan:** `MAX_LEVEL_SIDE`, `MAX_LEVELS` (`project.schema.ts`) and `MAX_LAYER_CELLS` (`project-codec.ts`) are now exported so the commands share the guard rails with the schema and the codec instead of copying them.
- **Evidence (local, Node 24):** see the PR's Gates section.
- **Not run:** CI; the browser projects (no DOM, no hashes, no cross-engine behavior); any visual check (no screens). No Owner acceptance.

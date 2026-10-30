# ED2D.4c3a Level draw list (headless): TDD plan

- **Task:** ED2D.4c3a in [02](../../02-master-delivery-plan.md). [2D editor spec](../specs/2026-10-23-editor-2d-design.md) §4 (the `canvas/` folder and the boundary rules), §5.2 (the five layer kinds), §5.3 (16 × 16-cell chunks shared between snapshots, ED2D-D4), §5.4 (tileset columns, spacing, padding; a placeholder set), §5.5 (entity shape, size, pivot, tile), §5.6 (the auto layer's derived output and overrides), §5.9 (the brush footprint), §8 (the Level view canvas: grid, snap and selection), §13 (a missing or corrupt tileset image draws numbered placeholder tiles, ED2D-D11); acceptance G-s (no template or profile id in `src/canvas`).
- **Lane:** editor-2d. **Depends on:** ED2D.4b (the controller's `LevelEditorView`, merged in #146) and ED2D.3 (templates, merged). **Unblocks:** ED2D.4c3b (the Pixi canvas renders this list with its texture manager).
- **Status:** Planned 2026-10-30 on `claude/editors-ed2d-4c3a-draw-list`. The 2D spec is drafted, not reviewed.
- **Progress:** 0 of 6 steps.

## Why this task exists

The Pixi canvas of ED2D.4c3b has to decide, for every frame the project or the view changes, which tile goes where, which colour an IntGrid cell is, where an entity's box sits, what a missing image looks like and where the brush footprint and the selection are. Written inside the renderer, all of that could only be tested in a browser with a GPU. This slice writes it once as a pure function from the project and the controller's view to plain data, tested in Node with fixed numbers; the renderer then only turns each item into a sprite or a rectangle.

## Sources, read at these commits

- **The Last Light, `mcthaydt/PixiJS3D_Experiment_001` at `92e6704`:** `editor/src/client/plan.ts` and `level-tools.ts` were read for a 2D draw path. They draw a sector plan straight into Pixi and have no tile layers, tilesets or chunking, so nothing is extracted; the shape of the answer (a scene as data, painted by the app) follows AF's own ED3D.4 `planScene` instead.
- **AF:** `model/grid.ts` (chunks, sharing), `model/cells-codec.ts` (`unpackTile`), `model/tileset-grid.ts` (`tilesetTiles`), `model/level-layers.ts` (`layerCells`), `model/commands/entity-geometry.ts` (`entityBounds`, `Bounds`), `tiles/footprint.ts` (`brushCells`), `tiles/autotile/` (`compileRules`, `autoTiles`, `applyOverrides`), `app/level-editor.ts` (`LevelEditorView`), `testing/architecture.ts`.

## Scope

**In:** `packages/editor-2d/src/canvas/draw/`, plain TypeScript run in the `unit` project; `Grid.chunks()` in `model/grid.ts`; the architecture rules extended to `canvas/`.

**Out, with owner:**

| What | Where |
|---|---|
| Pixi, the texture manager, loading images, `webglcontextlost`, resolving colour tokens to numbers, Home thumbnails | ED2D.4c3b |
| Mapping the pointer to level pixels, zoom and pan, culling chunks against the viewport | ED2D.4c3b and ED2D.4c4a (`Viewport2D`) |
| A ghost of the entity or object about to be placed, resize handles, marquee, stamp preview | ED2D.4c4a, ED2D.4d |
| Point-list paths and ref links drawn between entities | ED2D.4c4b (inspector) and ED2D.6b (world map) |
| Selecting objects (no object hit test yet) | ED2D.4d |
| Re-evaluating only the auto cells a stroke reaches (`windowAround`) | ED2D.4c3b if the full evaluation is too slow on the guard-rail sizes; here the auto layer is evaluated whole and memoized |
| The level background image | ED2D.4c3b (it is drawn under the layers when the texture manager has it; the list passes its path and mode through) |

## Decisions made here (each vetoable by the Owner)

1. **A draw list is data, not a drawing.** `createLevelDrawList()` returns a function from `{ project, view, images }` to a `LevelDrawList`: the level's size and background, its visible layers **back to front** (the reverse of `defs.layers`, which is front to back as the panel shows them), and the overlays. Nothing in `canvas/draw/` imports Pixi, Svelte or the DOM; the architecture test holds it to the same rules as `model/` and `tiles/`.
2. **Cell layers come in 16 × 16-cell chunks, and an unchanged chunk is the same object.** Tiles and IntGrid layers draw one item per stored chunk of their `Grid` (empty chunks are not stored, so they cost nothing). The drawer keeps the chunk it built for each grid chunk (keyed by the grid chunk's identity, which ED2D-D4 keeps across `History` snapshots) and returns that same object while the chunk, the cell size and its tileset (or value list) are unchanged, so the renderer rebuilds only the chunks a stroke touched by comparing with `===`. The auto layer is evaluated whole (`compileRules`, `autoTiles`, `applyOverrides`) and memoized on its inputs (source grid, rule groups, seed, overrides, tileset, image); its chunks are new objects when any input changes.
3. **The input view is the controller's.** The list reads `Pick<LevelEditorView, 'level' | 'layer' | 'tool' | 'brushSize' | 'hover' | 'rectangle' | 'selected' | 'hidden' | 'locked'>` (a type-only import from `app/level-editor.ts`, the owner), so the canvas and the tools never disagree about what is chosen.
4. **`images` is the set of image paths the texture manager has loaded.** A tile draws its frame from the image when its tileset has an `image` in that set and the index is inside the tileset; otherwise it is a **numbered placeholder** (the tile index, a flat colour chosen by index from a fixed palette of twelve) with the reason: `placeholder` (a set with no image), `missing` (an image that is not loaded: not imported, missing or corrupt, §13), `outOfRange` (an index beyond the tileset) or `noTileset` (the layer names a tileset the project lacks). The frame is `padding + column × (tile + spacing)` by `padding + row × (tile + spacing)`, row-major, as `tilesetTiles` counts them.
5. **Positions are level pixels.** A tile and an IntGrid cell fill their cell at the layer's grid size (the renderer scales the frame); an auto cell's stack is several tiles at the same cell in rule order; an object is its tileset's tile size with its top-left at `(x, y)`; an entity is its `entityBounds` box plus its pivot point, shape, colour (a `#rrggbb` or a kit token name, passed through for the renderer to resolve) and, for a `tile` shape, its tile. An entity whose definition is gone is not drawn, as `entityAt` does not hit it; Checks report it.
6. **Hidden layers are left out; locked layers are drawn** and marked `locked`. Opacity comes from the definition (entities and objects are 1).
7. **Overlays follow the active layer.** The grid is that layer's grid (an objects layer's `snap`, none when 0), as line positions from 0 to the level's edge. The footprint is drawn on tiles, IntGrid and auto layers only: brush and eraser show the brush square at the hover cell, rectangle the live rectangle (inclusive corners, either order) or the hover cell, fill and picker the hover cell, select nothing; it is clipped to the layer, marked `erase` for the eraser, and absent on a locked or hidden layer (the pointer does nothing there). The selection is the `entityBounds` of each selected id found on a visible entities layer of the level.
8. **The draw list lives in `canvas/draw/`,** a subfolder of the spec's `canvas/`, so the rule "the draw list is headless" is a path rule and the Pixi files of ED2D.4c3b sit beside it in `canvas/`.

## Contract

```ts
// model/grid.ts
export interface GridChunk {
  readonly cx: number                       // chunk column, in chunks
  readonly cy: number
  /** The same object while this chunk is unchanged (ED2D-D4); opaque. */
  readonly token: object
  /** Its non-zero cells in grid coordinates, row-major. */
  cells(): readonly { readonly x: number; readonly y: number; readonly value: number }[]
}
class Grid { chunks(): readonly GridChunk[] }       // stored chunks, row-major by (cy, cx)

// canvas/draw/draw-list-types.ts
export type PlaceholderReason = 'placeholder' | 'missing' | 'outOfRange' | 'noTileset'
export type TileDraw = Bounds & { readonly tile: number; readonly flipX: boolean; readonly flipY: boolean } & (
  | { readonly kind: 'image'; readonly image: string; readonly frame: Bounds }
  | { readonly kind: 'placeholder'; readonly reason: PlaceholderReason; readonly color: string; readonly label: string })
export interface TileChunk { readonly cx: number; readonly cy: number; readonly bounds: Bounds; readonly tiles: readonly TileDraw[] }
export interface IntCellDraw extends Bounds { readonly value: number; readonly color: string | undefined }
export interface IntChunk { readonly cx: number; readonly cy: number; readonly bounds: Bounds; readonly cells: readonly IntCellDraw[] }
export interface EntityDraw extends Bounds { readonly id; readonly def; readonly shape: EntityShape; readonly pivot: Point; readonly color: string | undefined; readonly label: string; readonly tile: TileDraw | undefined }
export interface ObjectDraw extends TileDraw { readonly id: string }
export type LayerDraw =
  | { kind: 'tiles' | 'auto'; def; opacity; locked; chunks: readonly TileChunk[] }
  | { kind: 'intgrid'; def; opacity; locked; chunks: readonly IntChunk[] }
  | { kind: 'entities'; def; opacity: 1; locked; entities: readonly EntityDraw[] }
  | { kind: 'objects'; def; opacity: 1; locked; objects: readonly ObjectDraw[] }
export interface Footprint extends Bounds { readonly erase: boolean }
export interface LevelDrawList {
  readonly level: string
  readonly size: Size
  readonly background: Background            // image only when loaded
  readonly layers: readonly LayerDraw[]      // back to front
  readonly grid: { readonly step: number; readonly xs: readonly number[]; readonly ys: readonly number[] } | undefined
  readonly footprint: Footprint | undefined
  readonly selection: readonly (Bounds & { readonly id: string })[]
}
export type DrawView = Pick<LevelEditorView, 'level' | 'layer' | 'tool' | 'brushSize' | 'hover' | 'rectangle' | 'selected' | 'hidden' | 'locked'>
export interface LevelDrawInput { readonly project: Project; readonly view: DrawView; readonly images: ReadonlySet<string> }

// canvas/draw/level-draw-list.ts
export function createLevelDrawList(): (input: LevelDrawInput) => LevelDrawList
```

## Files

- Create: `src/canvas/draw/draw-list-types.ts`, `tile-draw.ts` (+ test: frames and placeholders), `cell-chunks.ts` (+ test: tiles, IntGrid and auto chunks and their memo), `overlays.ts` (+ test: grid, footprint, selection), `level-draw-list.ts` (+ test: layers, order, hidden, locked, entities, objects, background, the templates end to end).
- Modify: `src/model/grid.ts` and `grid.test.ts` (`chunks()`), `src/testing/architecture.ts` and `src/architecture.test.ts` (`canvas/draw/` is headless; the real tree must include `canvas/` files), `src/index.ts` and `index.test.ts`, the spec §4 (as built), this plan.

## Steps

Each step starts with a failing test and its reason. After each: the package's `typecheck` and the focused `vitest run`; at the end a hand mutation pass on the new files (one condition or constant at a time; every survivor gets a test or a reason it is equivalent).

- [ ] **1. `Grid.chunks()`.** Fails: no method. An empty grid has none; chunks come row-major with their chunk position and cells in grid coordinates; an edit keeps the token of every chunk it did not touch and gives the touched one a new token; a chunk edited back to all zero is gone.
- [ ] **2. Tile sources.** Fails: no module. A tile of a loaded image draws its frame (spacing and padding, row-major); no image is `placeholder`, an image not loaded is `missing`, an index beyond the set is `outOfRange`, a missing tileset is `noTileset`; placeholders are numbered by index and their colour is fixed by index; flips pass through.
- [ ] **3. Cell chunks.** Fails: no module. A tiles layer gives one chunk per stored grid chunk with each tile at its cell at the grid size; an IntGrid layer gives each cell its value's colour (`undefined` for a value the layer does not define); an auto layer's tiles equal `applyOverrides(autoTiles(…))` with stacks in order, grouped into 16 × 16 chunks; the same drawer returns the same chunk objects for an unchanged grid chunk and new ones only for touched chunks, and rebuilds when the tileset or the loaded image changes.
- [ ] **4. The level.** Fails: no `createLevelDrawList`. Layers back to front, hidden ones left out, locked ones marked, opacity from the definition; entities with bounds, pivot, shape, colour, label and a `tile` shape's tile, a missing definition left out, items in order; objects at the tileset's tile size; the background image only when loaded; a missing level throws `RangeError`; both the platformer and the RPG templates draw with no error.
- [ ] **5. Overlays.** Fails: no overlays. The grid of the active layer (an objects layer by its snap, none at 0) with the edge line; the footprint per tool (brush sizes 1 and 2, eraser marked, rectangle live in either order and at hover, fill and picker one cell, select none), clipped to the layer, none on an entities or objects layer, a locked or a hidden layer or without hover; the selection boxes of selected entities, skipping ids that are not on a visible layer.
- [ ] **6. Architecture, exports and gates.** Fails: a planted `canvas/draw/` file importing `pixi.js` or reading `Date` passes; the real tree's scan has no `canvas/` file. `canvas/draw/` joins the headless core; a planted `canvas/level-view.ts` importing `pixi.js` still passes; the real-tree test asserts `canvas/` files are scanned (G-s). Export from the index; spec §4 as built; `pnpm format`, `TURBO_FORCE=true pnpm check`, changeset status.

## Gates

The package's `typecheck` and `test:unit`; `pnpm format`; `TURBO_FORCE=true pnpm check` (lint, typecheck, boundaries, style, knip, unit tests). Not run: the `browsers` parity project (no hash or engine-dependent arithmetic here: integer pixel positions only), layout tests (no DOM), any visual check (nothing is rendered until ED2D.4c3b), CI (hosted runners are not getting jobs).

## Execution record

(Updated as steps pass.)

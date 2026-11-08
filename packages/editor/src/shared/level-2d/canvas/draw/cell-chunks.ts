import { unpackTile } from '../../model/cells-codec'
import type { Bounds } from '../../model/commands/entity-geometry'
import { CHUNK, Grid, type GridChunk } from '../../model/grid'
import type {
  AutoLayerDef,
  AutoLayerInstance,
  IntGridLayerDef,
  IntValueDef,
  TilesetDef,
  TilesLayerDef,
} from '../../model/project-types'
import { type AutoTiles, applyOverrides, autoTiles } from '../../tiles/autotile/auto-tiles'
import type { AutoTile } from '../../tiles/autotile/match'
import { compileRules } from '../../tiles/autotile/match'
import type { IntChunk, TileChunk, TileDraw } from './draw-list-types'
import { tileDraw } from './tile-draw'

// The cell layers drawn a 16 × 16-cell chunk at a time (2D editor spec §5.3, ED2D-D4). A `Grid` shares every chunk an
// edit did not touch, so the drawer keeps what it built for each grid chunk (by the chunk's token) and hands back that
// very object while the chunk and what it is drawn with are unchanged: the renderer compares chunks with `===` and
// rebuilds only those a stroke touched. The auto layer's output is derived from a whole IntGrid, so it is evaluated
// whole and kept until one of its inputs changes.

/** What a kept chunk was drawn with: if any of these differ, it is drawn again. */
interface Drawn<Chunk, With> {
  readonly with: With
  readonly chunk: Chunk
}

/** The layer's cell size and its size in cells: an edge chunk's bounds are cut by the size. */
interface Layout {
  readonly grid: number
  readonly cols: number
  readonly rows: number
}

interface TileInputs extends Layout {
  readonly tileset: TilesetDef | undefined
  /** 0 when the tileset's image is not loaded, else the image's generation (see `loadedGeneration`). */
  readonly loaded: number
}

interface IntInputs extends Layout {
  readonly values: readonly IntValueDef[]
}

interface AutoInputs {
  readonly def: AutoLayerDef
  readonly source: Grid | undefined
  readonly tileset: TilesetDef | undefined
  /** 0 when the tileset's image is not loaded, else the image's generation (see `loadedGeneration`). */
  readonly loaded: number
}

export interface CellChunks {
  tiles(
    def: TilesLayerDef,
    cells: Grid,
    tileset: TilesetDef | undefined,
    images: ReadonlySet<string>,
    generations?: ImageGenerations,
  ): TileChunk[]
  intgrid(def: IntGridLayerDef, cells: Grid): IntChunk[]
  /** `source` is the level's instance of `def.source`; `undefined` when the level has none (Checks report it). */
  auto(
    def: AutoLayerDef,
    instance: AutoLayerInstance,
    source: Grid | undefined,
    tileset: TilesetDef | undefined,
    images: ReadonlySet<string>,
    generations?: ImageGenerations,
  ): readonly TileChunk[]
}

/** Each loaded image's generation: an image loaded again (after the texture manager forgot it) has a new one. */
type ImageGenerations = ReadonlyMap<string, number>
const NO_GENERATIONS: ImageGenerations = new Map()

/**
 * 0 for a tileset whose image is not loaded, else the image's generation (1 when none is given). A kept chunk is drawn
 * again when this changes, because the texture its sprites showed is gone once an image is loaded again.
 */
function loadedGeneration(
  tileset: TilesetDef | undefined,
  images: ReadonlySet<string>,
  generations: ImageGenerations,
): number {
  if (tileset?.image === undefined || !images.has(tileset.image)) return 0
  return generations.get(tileset.image) ?? 1
}

const sameLayout = (a: Layout, b: Layout): boolean =>
  a.grid === b.grid && a.cols === b.cols && a.rows === b.rows

const sameTileInputs = (a: TileInputs, b: TileInputs): boolean =>
  sameLayout(a, b) && a.tileset === b.tileset && a.loaded === b.loaded

const sameIntInputs = (a: IntInputs, b: IntInputs): boolean => sameLayout(a, b) && a.values === b.values

const sameAutoInputs = (a: AutoInputs, b: AutoInputs): boolean =>
  a.def === b.def && a.source === b.source && a.tileset === b.tileset && a.loaded === b.loaded

const layoutOf = (grid: number, cells: Grid): Layout => ({ grid, cols: cells.cols, rows: cells.rows })

/** A chunk's rectangle in level pixels, clipped to a grid of `cols` × `rows` cells of `grid` px. */
function chunkBounds(cx: number, cy: number, cols: number, rows: number, grid: number): Bounds {
  return {
    x: cx * CHUNK * grid,
    y: cy * CHUNK * grid,
    w: Math.min(CHUNK, cols - cx * CHUNK) * grid,
    h: Math.min(CHUNK, rows - cy * CHUNK) * grid,
  }
}

/** The chunks of `cells`, each the kept one when `memo` holds it drawn with `inputs`, else `draw`n and kept. */
function chunksOf<Chunk, With>(
  cells: Grid,
  memo: WeakMap<object, Drawn<Chunk, With>>,
  inputs: With,
  same: (a: With, b: With) => boolean,
  draw: (chunk: GridChunk) => Chunk,
): Chunk[] {
  return cells.chunks().map((gridChunk) => {
    const kept = memo.get(gridChunk.token)
    if (kept !== undefined && same(kept.with, inputs)) return kept.chunk
    const chunk = draw(gridChunk)
    memo.set(gridChunk.token, { with: inputs, chunk })
    return chunk
  })
}

/** The tiles of an auto result in 16 × 16-cell chunks, row-major by chunk, each cell's stack in order. */
function autoChunks(
  result: AutoTiles,
  grid: number,
  draw: (tile: AutoTile, at: Bounds) => TileDraw,
): TileChunk[] {
  const byChunk = new Map<number, TileDraw[]>()
  const chunkCols = Math.ceil(result.cols / CHUNK)
  for (const key of [...result.stacks.keys()].sort((a, b) => a - b)) {
    const x = key % result.cols
    const y = Math.floor(key / result.cols)
    const chunkKey = Math.floor(y / CHUNK) * chunkCols + Math.floor(x / CHUNK)
    let tiles = byChunk.get(chunkKey)
    if (tiles === undefined) {
      tiles = []
      byChunk.set(chunkKey, tiles)
    }
    for (const tile of result.stacks.get(key) ?? [])
      tiles.push(draw(tile, { x: x * grid, y: y * grid, w: grid, h: grid }))
  }
  return [...byChunk.keys()]
    .sort((a, b) => a - b)
    .map((chunkKey) => {
      const cx = chunkKey % chunkCols
      const cy = Math.floor(chunkKey / chunkCols)
      return {
        cx,
        cy,
        bounds: chunkBounds(cx, cy, result.cols, result.rows, grid),
        tiles: byChunk.get(chunkKey) ?? [],
      }
    })
}

/** A memo per layer definition id, made on first use. */
function perLayer<Memo>(make: () => Memo): (layer: string) => Memo {
  const memos = new Map<string, Memo>()
  return (layer) => {
    let memo = memos.get(layer)
    if (memo === undefined) {
      memo = make()
      memos.set(layer, memo)
    }
    return memo
  }
}

const sameBounds = (a: Bounds, b: Bounds): boolean => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h

/** Two tiles that draw the same: place, tile, flips and source. */
function sameTile(a: TileDraw, b: TileDraw): boolean {
  if (!sameBounds(a, b) || a.tile !== b.tile || a.flipX !== b.flipX || a.flipY !== b.flipY) return false
  if (a.kind === 'image' && b.kind === 'image') return a.image === b.image && sameBounds(a.frame, b.frame)
  if (a.kind === 'placeholder' && b.kind === 'placeholder')
    return a.reason === b.reason && a.color === b.color && a.label === b.label
  return false
}

/**
 * `next` with each chunk replaced by the previous chunk at the same place when it draws exactly the same tiles, so an
 * IntGrid edit leaves the auto chunks beyond the rules' reach as the very objects the renderer already has.
 */
function reuseChunks(previous: readonly TileChunk[], next: readonly TileChunk[]): readonly TileChunk[] {
  const byPlace = new Map(previous.map((chunk) => [`${chunk.cx},${chunk.cy}`, chunk]))
  return next.map((chunk) => {
    const old = byPlace.get(`${chunk.cx},${chunk.cy}`)
    const same =
      old !== undefined &&
      sameBounds(old.bounds, chunk.bounds) &&
      old.tiles.length === chunk.tiles.length &&
      old.tiles.every((tile, i) => sameTile(tile, chunk.tiles[i] as TileDraw))
    return same ? old : chunk
  })
}

/** One drawer per canvas: it keeps the chunks it drew, so each canvas compares against its own last frame. */
export function createCellChunks(): CellChunks {
  // Kept per layer definition, so two layers never share a chunk object (a renderer may key its sprites by chunk),
  // even when they hold the same grid chunk, as a duplicated level does.
  const tileMemo = perLayer<WeakMap<object, Drawn<TileChunk, TileInputs>>>(() => new WeakMap())
  const intMemo = perLayer<WeakMap<object, Drawn<IntChunk, IntInputs>>>(() => new WeakMap())
  const autoMemo = perLayer<WeakMap<AutoLayerInstance, Drawn<readonly TileChunk[], AutoInputs>>>(
    () => new WeakMap(),
  )
  /** Each auto layer's last chunks, whose objects a new evaluation reuses where a chunk's tiles came out the same. */
  const lastAuto = new Map<string, { readonly chunks: readonly TileChunk[]; readonly loaded: number }>()

  return {
    tiles(def, cells, tileset, images, generations = NO_GENERATIONS) {
      const inputs = {
        ...layoutOf(def.grid, cells),
        tileset,
        loaded: loadedGeneration(tileset, images, generations),
      }
      return chunksOf(cells, tileMemo(def.id), inputs, sameTileInputs, ({ cx, cy, cells: cellsOf }) => ({
        cx,
        cy,
        bounds: chunkBounds(cx, cy, cells.cols, cells.rows, def.grid),
        tiles: cellsOf().flatMap(({ x, y, value }) => {
          const tile = unpackTile(value)
          const at = { x: x * def.grid, y: y * def.grid, w: def.grid, h: def.grid }
          return tile === undefined ? [] : [tileDraw(tileset, images, tile, at)]
        }),
      }))
    },

    intgrid(def, cells) {
      const inputs = { ...layoutOf(def.grid, cells), values: def.values }
      return chunksOf(cells, intMemo(def.id), inputs, sameIntInputs, ({ cx, cy, cells: cellsOf }) => ({
        cx,
        cy,
        bounds: chunkBounds(cx, cy, cells.cols, cells.rows, def.grid),
        cells: cellsOf().map(({ x, y, value }) => ({
          x: x * def.grid,
          y: y * def.grid,
          w: def.grid,
          h: def.grid,
          value,
          color: def.values.find((candidate) => candidate.value === value)?.color,
        })),
      }))
    },

    auto(def, instance, source, tileset, images, generations = NO_GENERATIONS) {
      const inputs = { def, source, tileset, loaded: loadedGeneration(tileset, images, generations) }
      const memo = autoMemo(def.id)
      const kept = memo.get(instance)
      if (kept !== undefined && sameAutoInputs(kept.with, inputs)) return kept.chunk
      const { cols, rows } = instance.overrides
      const derived = autoTiles(source ?? Grid.empty(cols, rows), compileRules(def.groups), instance.seed)
      const result = applyOverrides(derived, instance.overrides)
      const drawn = autoChunks(result, def.grid, (tile, at) => tileDraw(tileset, images, tile, at))
      // Chunk objects drawn from another generation of the image are never reused: their textures are gone.
      const last = lastAuto.get(def.id)
      const chunks = reuseChunks(last?.loaded === inputs.loaded ? last.chunks : [], drawn)
      lastAuto.set(def.id, { chunks, loaded: inputs.loaded })
      memo.set(instance, { with: inputs, chunk: chunks })
      return chunks
    },
  }
}

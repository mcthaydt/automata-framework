import { describe, expect, it } from 'vitest'
import { packTile } from '../../model/cells-codec'
import { Grid } from '../../model/grid'
import type {
  AutoLayerDef,
  AutoLayerInstance,
  IntGridLayerDef,
  TilesetDef,
  TilesLayerDef,
} from '../../model/project-types'
import { caveGrid, hillGrid, platformerRules } from '../../testing/autotile-fixtures'
import { applyOverrides, autoTiles } from '../../tiles/autotile/auto-tiles'
import { compileRules } from '../../tiles/autotile/match'
import { createCellChunks } from './cell-chunks'
import type { TileChunk } from './draw-list-types'

const terrain: TilesetDef = {
  id: 'terrain',
  label: 'Terrain',
  image: 'assets/terrain.png',
  imageSize: { w: 128, h: 128 },
  tile: { w: 16, h: 16 },
  spacing: 0,
  padding: 0,
  tags: [],
}
const loaded = new Set(['assets/terrain.png'])
const decor: TilesLayerDef = {
  id: 'decor',
  label: 'Decor',
  kind: 'tiles',
  grid: 8,
  tileset: 'terrain',
  opacity: 1,
}
const collision: IntGridLayerDef = {
  id: 'collision',
  label: 'Collision',
  kind: 'intgrid',
  grid: 16,
  values: [
    { value: 1, id: 'solid', color: '#ff0000' },
    { value: 2, id: 'water', color: '#0000ff' },
  ],
  opacity: 1,
}

/** Each tile as `[x, y, tile]`, so a test reads where tiles went at a glance. */
const placed = (chunk: TileChunk | undefined) => chunk?.tiles.map((tile) => [tile.x, tile.y, tile.tile])

describe('cell chunks: tiles', () => {
  it('draws one chunk per stored grid chunk, each tile filling its cell at the layer’s grid size', () => {
    const cells = Grid.empty(40, 20)
      .set(1, 2, packTile(3, true, false))
      .set(17, 0, packTile(4, false, false))
      .set(2, 18, packTile(5, false, true))
    const chunks = createCellChunks().tiles(decor, cells, terrain, loaded)
    expect(chunks.map((chunk) => [chunk.cx, chunk.cy])).toEqual([
      [0, 0],
      [1, 0],
      [0, 1],
    ])
    expect(chunks[0]?.tiles).toEqual([
      {
        x: 8,
        y: 16,
        w: 8,
        h: 8,
        tile: 3,
        flipX: true,
        flipY: false,
        kind: 'image',
        image: 'assets/terrain.png',
        frame: { x: 48, y: 0, w: 16, h: 16 },
      },
    ])
    expect(placed(chunks[1])).toEqual([[136, 0, 4]])
    expect(chunks[2]?.tiles[0]).toMatchObject({ x: 16, y: 144, flipY: true })
  })

  it('gives a chunk its bounds in level pixels, clipped to the layer', () => {
    const cells = Grid.empty(40, 20).set(0, 0, 1).set(39, 19, 1)
    const [first, last] = createCellChunks().tiles(decor, cells, terrain, loaded)
    expect(first?.bounds).toEqual({ x: 0, y: 0, w: 128, h: 128 })
    expect(last?.bounds).toEqual({ x: 256, y: 128, w: 64, h: 32 })
  })

  it('draws placeholders when the image is not loaded or the tileset is gone', () => {
    const cells = Grid.empty(4, 4).set(0, 0, packTile(2, false, false))
    expect(createCellChunks().tiles(decor, cells, terrain, new Set())[0]?.tiles[0]).toMatchObject({
      kind: 'placeholder',
      reason: 'missing',
      label: '2',
    })
    expect(createCellChunks().tiles(decor, cells, undefined, loaded)[0]?.tiles[0]).toMatchObject({
      reason: 'noTileset',
    })
  })

  it('returns the very chunk it drew before for a grid chunk an edit did not touch, and a new one for a touched chunk', () => {
    const chunks = createCellChunks()
    const cells = Grid.empty(40, 20).set(1, 1, 1).set(20, 1, 2)
    const before = chunks.tiles(decor, cells, terrain, loaded)
    const after = chunks.tiles(decor, cells.set(21, 1, 3), terrain, loaded)
    expect(after[0]).toBe(before[0])
    expect(after[1]).not.toBe(before[1])
    expect(placed(after[1])).toEqual([
      [160, 8, 1],
      [168, 8, 2],
    ])
  })

  it('draws a kept chunk again when what it depends on changes: the tileset, its image, the grid size', () => {
    const chunks = createCellChunks()
    const cells = Grid.empty(4, 4).set(1, 1, 1)
    const first = chunks.tiles(decor, cells, terrain, loaded)[0]
    expect(chunks.tiles(decor, cells, terrain, new Set(['assets/terrain.png']))[0]).toBe(first)
    expect(chunks.tiles(decor, cells, terrain, new Set())[0]).not.toBe(first)
    expect(chunks.tiles(decor, cells, { ...terrain, padding: 1 }, loaded)[0]).not.toBe(first)
    expect(chunks.tiles({ ...decor, grid: 16 }, cells, terrain, loaded)[0]).toMatchObject({
      tiles: [{ x: 16, y: 16, w: 16, h: 16 }],
    })
  })

  it('draws a kept chunk again when the level grows, since a chunk that was cut by the edge is no longer', () => {
    const chunks = createCellChunks()
    const cells = Grid.empty(4, 4).set(1, 1, 1)
    expect(chunks.tiles(decor, cells, terrain, loaded)[0]?.bounds).toEqual({ x: 0, y: 0, w: 32, h: 32 })
    const grown = cells.resize(40, 40)
    expect(grown.sharesChunk(cells, 1, 1)).toBe(true)
    expect(chunks.tiles(decor, grown, terrain, loaded)[0]?.bounds).toEqual({ x: 0, y: 0, w: 128, h: 128 })
    expect(chunks.intgrid(collision, cells)[0]?.bounds).toEqual({ x: 0, y: 0, w: 64, h: 64 })
    expect(chunks.intgrid(collision, grown)[0]?.bounds).toEqual({ x: 0, y: 0, w: 256, h: 256 })
    const wider = Grid.empty(4, 16).set(1, 1, 1)
    expect(chunks.tiles(decor, wider, terrain, loaded)[0]?.bounds).toEqual({ x: 0, y: 0, w: 32, h: 128 })
    expect(chunks.tiles(decor, wider.resize(16, 16), terrain, loaded)[0]?.bounds).toEqual({
      x: 0,
      y: 0,
      w: 128,
      h: 128,
    })
  })
})

describe('cell chunks: IntGrid', () => {
  it('fills each cell with its value’s colour', () => {
    const cells = Grid.empty(20, 4).set(0, 1, 1).set(3, 1, 2).set(17, 3, 1)
    const chunks = createCellChunks().intgrid(collision, cells)
    expect(chunks.map((chunk) => chunk.cells)).toEqual([
      [
        { x: 0, y: 16, w: 16, h: 16, value: 1, color: '#ff0000' },
        { x: 48, y: 16, w: 16, h: 16, value: 2, color: '#0000ff' },
      ],
      [{ x: 272, y: 48, w: 16, h: 16, value: 1, color: '#ff0000' }],
    ])
    expect(chunks[1]?.bounds).toEqual({ x: 256, y: 0, w: 64, h: 64 })
  })

  it('leaves a value the layer does not define without a colour', () => {
    const chunks = createCellChunks().intgrid(collision, Grid.empty(2, 2).set(1, 1, 9))
    expect(chunks[0]?.cells).toEqual([{ x: 16, y: 16, w: 16, h: 16, value: 9, color: undefined }])
  })

  it('keeps an untouched chunk and redraws all when the values change', () => {
    const chunks = createCellChunks()
    const cells = Grid.empty(40, 4).set(0, 0, 1).set(20, 0, 1)
    const before = chunks.intgrid(collision, cells)
    const after = chunks.intgrid(collision, cells.set(20, 0, 2))
    expect(after[0]).toBe(before[0])
    expect(after[1]).not.toBe(before[1])
    const recoloured = { ...collision, values: [{ value: 1, id: 'solid', color: '#00ff00' }] }
    expect(chunks.intgrid(recoloured, cells)[0]?.cells[0]?.color).toBe('#00ff00')
  })
})

describe('cell chunks: auto', () => {
  const ground: AutoLayerDef = {
    id: 'ground',
    label: 'Ground',
    kind: 'auto',
    grid: 16,
    source: 'collision',
    tileset: 'terrain',
    groups: platformerRules({ variation: false }),
    opacity: 1,
  }
  const instance = (overrides: Grid, seed = 1): AutoLayerInstance => ({
    def: 'ground',
    kind: 'auto',
    seed,
    overrides,
  })

  it('draws the engine’s stacks, in rule order, with the overrides painted over them', () => {
    const source = hillGrid()
    const overrides = Grid.empty(5, 4).set(0, 3, packTile(30, true, false))
    const chunks = createCellChunks().auto(ground, instance(overrides), source, terrain, loaded)
    const expected = applyOverrides(autoTiles(source, compileRules(ground.groups), 1), overrides)
    const drawn = chunks.flatMap((chunk) => chunk.tiles)
    const fromEngine = [...expected.stacks.keys()]
      .sort((a, b) => a - b)
      .flatMap((key) =>
        (expected.stacks.get(key) ?? []).map((tile) => [(key % 5) * 16, Math.floor(key / 5) * 16, tile.tile]),
      )
    expect(drawn.map((tile) => [tile.x, tile.y, tile.tile])).toEqual(fromEngine)
    expect(drawn.find((tile) => tile.x === 0 && tile.y === 48)).toMatchObject({ tile: 30, flipX: true })
    expect(drawn.find((tile) => tile.x === 48 && tile.y === 16)).toMatchObject({ tile: 16, flipX: true })
  })

  it('groups the cells into 16 × 16 chunks, row-major', () => {
    const source = caveGrid()
    const chunks = createCellChunks().auto(ground, instance(Grid.empty(48, 32)), source, terrain, loaded)
    expect(chunks.map((chunk) => [chunk.cx, chunk.cy])).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ])
    for (const chunk of chunks) {
      expect(chunk.bounds).toEqual({ x: chunk.cx * 256, y: chunk.cy * 256, w: 256, h: 256 })
      for (const tile of chunk.tiles) {
        expect(Math.floor(tile.x / 256)).toBe(chunk.cx)
        expect(Math.floor(tile.y / 256)).toBe(chunk.cy)
      }
    }
    const count = [...autoTiles(source, compileRules(ground.groups), 1).stacks.values()].reduce(
      (sum, stack) => sum + stack.length,
      0,
    )
    expect(chunks.reduce((sum, chunk) => sum + chunk.tiles.length, 0)).toBe(count)
  })

  it('draws only the overrides when the source layer is missing', () => {
    const overrides = Grid.empty(5, 4).set(2, 2, packTile(7, false, false))
    const chunks = createCellChunks().auto(ground, instance(overrides), undefined, terrain, loaded)
    expect(placed(chunks[0])).toEqual([[32, 32, 7]])
  })

  it('returns the same chunks for the same inputs, and new ones when any of them changes', () => {
    const chunks = createCellChunks()
    const source = hillGrid()
    const layer = instance(Grid.empty(5, 4))
    const first = chunks.auto(ground, layer, source, terrain, loaded)
    expect(chunks.auto(ground, layer, source, terrain, new Set(loaded))).toBe(first)
    expect(chunks.auto(ground, layer, source.set(0, 0, 1), terrain, loaded)).not.toBe(first)
    expect(chunks.auto(ground, instance(Grid.empty(5, 4), 2), source, terrain, loaded)).not.toBe(first)
    expect(chunks.auto({ ...ground }, layer, source, terrain, loaded)).not.toBe(first)
    expect(chunks.auto(ground, layer, source, terrain, new Set())[0]?.tiles[0]).toMatchObject({
      reason: 'missing',
    })
  })
})

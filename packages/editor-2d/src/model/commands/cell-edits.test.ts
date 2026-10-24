import { describe, expect, it } from 'vitest'
import { hollowmere, mossgate } from '../../testing/samples'
import { copyStamp, type Stamp } from '../../tiles/stamp'
import { packTile } from '../cells-codec'
import type { Grid } from '../grid'
import type { Project } from '../project-types'
import { tilesetTiles } from '../tileset-grid'
import {
  cellWord,
  eraseLayerCells,
  fillLayer,
  paintLayerCells,
  paintLayerRandom,
  paintLayerRect,
  pasteLayerStamp,
} from './cell-edits'
import type { LayerTarget } from './layer-target'

const COLLISION: LayerTarget = { level: 'moss-steps', layer: 'collision' }
const DECOR: LayerTarget = { level: 'moss-steps', layer: 'decor' }
const GROUND: LayerTarget = { level: 'moss-steps', layer: 'ground' }

function cellsOf(project: Project, target: LayerTarget): Grid {
  const layer = project.levels
    .find((level) => level.id === target.level)
    ?.layers.find((l) => l.def === target.layer)
  if (layer?.kind === 'intgrid' || layer?.kind === 'tiles') return layer.cells
  if (layer?.kind === 'auto') return layer.overrides
  throw new Error('not a cell layer')
}

const dump = (grid: Grid): string =>
  grid
    .nonEmpty()
    .map(({ x, y, value }) => `${x},${y}=${value}`)
    .join(' ')

describe('cell edits: painting', () => {
  it('changes exactly the cells it is given', () => {
    const project = mossgate()
    const before = cellsOf(project, COLLISION)
    const next = paintLayerCells(
      project,
      COLLISION,
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      4,
    )
    const after = cellsOf(next, COLLISION)
    expect(after.get(0, 0)).toBe(4)
    expect(after.get(1, 0)).toBe(4)
    expect(after.nonEmpty()).toHaveLength(before.nonEmpty().length + 2)
    expect(after.get(8, 15)).toBe(1)
  })

  it('leaves the original project alone and shares every chunk it did not touch', () => {
    const project = mossgate()
    const before = cellsOf(project, COLLISION)
    const snapshot = dump(before)
    const next = paintLayerCells(project, COLLISION, [{ x: 0, y: 0 }], 4)
    expect(dump(before)).toBe(snapshot)
    expect(before.sharesChunk(cellsOf(next, COLLISION), 20, 0)).toBe(true)
    expect(before.sharesChunk(cellsOf(next, COLLISION), 0, 0)).toBe(false)
  })

  it('returns the same project when every cell already holds the word', () => {
    const project = mossgate()
    expect(
      paintLayerCells(
        project,
        COLLISION,
        [
          { x: 8, y: 15 },
          { x: 9, y: 15 },
        ],
        1,
      ),
    ).toBe(project)
  })

  it('drops cells outside the level, and gives back the same project when none is inside', () => {
    const project = mossgate()
    expect(
      paintLayerCells(
        project,
        COLLISION,
        [
          { x: -1, y: 0 },
          { x: 99, y: 99 },
        ],
        1,
      ),
    ).toBe(project)
  })

  it('takes a one-shot iterable of cells', () => {
    function* cells() {
      yield { x: 2, y: 2 }
      yield { x: 3, y: 2 }
    }
    const next = paintLayerCells(mossgate(), COLLISION, cells(), 2)
    expect(cellsOf(next, COLLISION).get(3, 2)).toBe(2)
  })

  it('erase writes the empty word', () => {
    const next = eraseLayerCells(mossgate(), COLLISION, [{ x: 8, y: 15 }])
    expect(cellsOf(next, COLLISION).get(8, 15)).toBe(0)
    expect(cellsOf(next, COLLISION).get(9, 15)).toBe(1)
  })

  it('paints a rectangle between two corners given in either order, both included', () => {
    const forward = paintLayerRect(mossgate(), COLLISION, { x: 2, y: 3 }, { x: 5, y: 5 }, 2)
    const backward = paintLayerRect(mossgate(), COLLISION, { x: 5, y: 5 }, { x: 2, y: 3 }, 2)
    expect(dump(cellsOf(forward, COLLISION))).toBe(dump(cellsOf(backward, COLLISION)))
    const painted = cellsOf(forward, COLLISION)
    expect(painted.get(2, 3)).toBe(2)
    expect(painted.get(5, 5)).toBe(2)
    expect(painted.get(6, 5)).toBe(0)
    expect(painted.get(2, 6)).toBe(0)
  })

  it('fills the connected cells that equal the start cell, and nothing else', () => {
    const next = fillLayer(mossgate(), COLLISION, { x: 8, y: 15 }, 2)
    const after = cellsOf(next, COLLISION)
    for (const x of [8, 9, 10]) expect(after.get(x, 15)).toBe(2)
    expect(after.get(11, 15)).toBe(0)
    expect(after.get(16, 11)).toBe(1)
  })

  it('fills an empty region up to the level edge and no further', () => {
    const project = mossgate()
    const next = fillLayer(project, COLLISION, { x: 0, y: 0 }, 1)
    const after = cellsOf(next, COLLISION)
    expect(after.get(0, 0)).toBe(1)
    expect(after.get(31, 0)).toBe(1)
    expect(after.cols).toBe(cellsOf(project, COLLISION).cols)
    expect(after.get(8, 15)).toBe(1)
    expect(after.get(23, 12)).toBe(5)
  })

  it('the dice give the same tiles for the same seed whatever the order of the cells', () => {
    const cells = Array.from({ length: 24 }, (_, i) => ({ x: i, y: 4 }))
    const candidates = [packTile(1, false, false), packTile(2, false, false), packTile(3, false, true)]
    const a = paintLayerRandom(mossgate(), DECOR, cells, candidates, 7)
    const b = paintLayerRandom(mossgate(), DECOR, [...cells].reverse(), candidates, 7)
    const c = paintLayerRandom(mossgate(), DECOR, cells, candidates, 8)
    expect(dump(cellsOf(a, DECOR))).toBe(dump(cellsOf(b, DECOR)))
    expect(dump(cellsOf(a, DECOR))).not.toBe(dump(cellsOf(c, DECOR)))
  })

  it('pastes a stamp, skipping its empty cells unless asked to clear', () => {
    const project = mossgate()
    const stamp: Stamp = { w: 2, h: 1, cells: new Uint32Array([0, 3]) }
    const kept = cellsOf(pasteLayerStamp(project, COLLISION, stamp, { x: 8, y: 15 }), COLLISION)
    expect(kept.get(8, 15)).toBe(1)
    expect(kept.get(9, 15)).toBe(3)
    const cleared = cellsOf(
      pasteLayerStamp(project, COLLISION, stamp, { x: 8, y: 15 }, { clear: true }),
      COLLISION,
    )
    expect(cleared.get(8, 15)).toBe(0)
    expect(cleared.get(9, 15)).toBe(3)
  })

  it('pastes a region copied from the same layer', () => {
    const project = mossgate()
    const stamp = copyStamp(cellsOf(project, COLLISION), 8, 15, 3, 1)
    const next = cellsOf(pasteLayerStamp(project, COLLISION, stamp, { x: 0, y: 0 }), COLLISION)
    expect([next.get(0, 0), next.get(1, 0), next.get(2, 0)]).toEqual([1, 1, 1])
  })
})

describe('cell edits: the word must belong to the layer', () => {
  it('refuses an IntGrid value the layer does not define', () => {
    expect(() => paintLayerCells(mossgate(), COLLISION, [{ x: 0, y: 0 }], 9)).toThrow(RangeError)
    expect(() => paintLayerCells(mossgate(), COLLISION, [{ x: 0, y: 0 }], 9)).toThrow(/value 9/)
  })

  it('accepts every value the layer defines and the empty word', () => {
    for (const value of [0, 1, 2, 3, 4, 5]) {
      expect(() => paintLayerCells(mossgate(), COLLISION, [{ x: 0, y: 0 }], value)).not.toThrow()
    }
  })

  it('refuses a tile beyond the layer tileset, with the tileset size in the message', () => {
    const project = mossgate()
    const tileset = project.defs.tilesets.find((candidate) => candidate.id === 'terrain')
    const count = tileset === undefined ? 0 : tilesetTiles(tileset).count
    expect(count).toBeGreaterThan(0)
    expect(() => paintLayerCells(project, DECOR, [{ x: 0, y: 0 }], packTile(count, false, false))).toThrow(
      new RangeError(`tile ${count} is beyond tileset "terrain", which has ${count} tiles`),
    )
    expect(() =>
      paintLayerCells(project, DECOR, [{ x: 0, y: 0 }], packTile(count - 1, true, true)),
    ).not.toThrow()
  })

  it('checks an auto layer overrides against its tileset too', () => {
    const project = mossgate()
    const tileset = project.defs.tilesets.find((candidate) => candidate.id === 'terrain')
    const count = tileset === undefined ? 0 : tilesetTiles(tileset).count
    expect(() => paintLayerCells(project, GROUND, [{ x: 0, y: 0 }], packTile(count, false, false))).toThrow(
      /beyond tileset "terrain"/,
    )
  })

  it('refuses a tile layer whose tileset is missing from the definitions', () => {
    const project = mossgate()
    const broken = { ...project, defs: { ...project.defs, tilesets: [] } }
    expect(() => paintLayerCells(broken, DECOR, [{ x: 0, y: 0 }], packTile(1, false, false))).toThrow(
      new RangeError('layer "decor" uses tileset "terrain", which is missing'),
    )
  })

  it('refuses a word that is not a tile cell at all', () => {
    expect(() => paintLayerCells(mossgate(), DECOR, [{ x: 0, y: 0 }], 0x20000001)).toThrow(RangeError)
  })

  it('checks every candidate of the dice and every cell of a stamp', () => {
    const project = mossgate()
    expect(() => paintLayerRandom(project, COLLISION, [{ x: 0, y: 0 }], [1, 9], 1)).toThrow(RangeError)
    const stamp: Stamp = { w: 2, h: 1, cells: new Uint32Array([1, 9]) }
    expect(() => pasteLayerStamp(project, COLLISION, stamp, { x: 0, y: 0 })).toThrow(RangeError)
  })

  it('checks the word even when no cell would change', () => {
    expect(() => paintLayerCells(mossgate(), COLLISION, [], 9)).toThrow(RangeError)
  })
})

describe('cell edits: the layer kinds', () => {
  it('an auto layer is edited through its overrides, never its seed', () => {
    const project = mossgate()
    const next = paintLayerCells(project, GROUND, [{ x: 3, y: 3 }], packTile(2, false, false))
    expect(cellsOf(next, GROUND).get(3, 3)).toBe(packTile(2, false, false))
    const before = project.levels[0]?.layers.find((layer) => layer.def === 'ground')
    const after = next.levels[0]?.layers.find((layer) => layer.def === 'ground')
    expect(before?.kind === 'auto' && after?.kind === 'auto' && after.seed).toBe(
      before?.kind === 'auto' && before.seed,
    )
  })

  it('refuses a layer that holds entities or objects, naming it', () => {
    expect(() =>
      paintLayerCells(mossgate(), { level: 'moss-steps', layer: 'entities' }, [{ x: 0, y: 0 }], 1),
    ).toThrow(new RangeError('layer "entities" has no cells'))
    expect(() =>
      eraseLayerCells(hollowmere(), { level: 'village', layer: 'props' }, [{ x: 0, y: 0 }]),
    ).toThrow(new RangeError('layer "props" has no cells'))
  })

  it('refuses a level that does not exist', () => {
    expect(() =>
      paintLayerCells(mossgate(), { level: 'nowhere', layer: 'collision' }, [{ x: 0, y: 0 }], 1),
    ).toThrow(new RangeError('no level "nowhere"'))
  })
})

describe('cellWord', () => {
  it('reads the word in a cell of each kind of cell layer, 0 when empty or outside the level', () => {
    const project = mossgate()
    expect(cellWord(project, COLLISION, { x: 8, y: 15 })).toBe(1)
    expect(cellWord(project, COLLISION, { x: 0, y: 0 })).toBe(0)
    expect(cellWord(project, COLLISION, { x: -1, y: 0 })).toBe(0)
    expect(cellWord(project, COLLISION, { x: 500, y: 0 })).toBe(0)
    expect(cellWord(project, DECOR, { x: 2, y: 15 })).toBe(packTile(51, false, false))
    expect(cellWord(project, DECOR, { x: 5, y: 15 })).toBe(packTile(52, true, false))
    const painted = paintLayerCells(project, GROUND, [{ x: 3, y: 3 }], packTile(2, false, false))
    expect(cellWord(painted, GROUND, { x: 3, y: 3 })).toBe(packTile(2, false, false))
  })

  it('refuses a layer without cells', () => {
    expect(() => cellWord(mossgate(), { level: 'moss-steps', layer: 'entities' }, { x: 0, y: 0 })).toThrow(
      new RangeError('layer "entities" has no cells'),
    )
  })
})

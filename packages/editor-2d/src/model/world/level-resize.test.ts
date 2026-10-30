import { describe, expect, it } from 'vitest'
import { checkProject } from '../../profiles/level-project/project-checks'
import { platformerTemplate } from '../../profiles/level-project/templates/platformer'
import {
  entity,
  paintLayer,
  withDefs,
  withEntities,
  withLayer,
  withLevel,
  withNewLevel,
} from '../../testing/project-edit'
import { hollowmere } from '../../testing/samples'
import { packTile } from '../cells-codec'
import type { Grid } from '../grid'
import { counterIds } from '../ids'
import { emptyLayers } from '../level-layers'
import type { Level, Placement, Project } from '../project-types'
import { resizeLevel, resizeLevelLoss } from './level-resize'
import { setWorldLayout } from './world-layout'

const START = { x: 'start', y: 'start' } as const
const END = { x: 'end', y: 'end' } as const
const CENTRE = { x: 'centre', y: 'centre' } as const

/**
 * The platformer's `level-1` (512 × 288 px, 32 × 18 cells of 16 px) emptied, then with collision at three cells, decor and a manual
 * ground tile in the far corner and a coin at (400, 200).
 */
function project(): Project {
  const template = platformerTemplate.create(counterIds())
  let p = withLevel(template, 'level-1', (found) => ({
    ...found,
    layers: emptyLayers(template.defs.layers, found.size),
  }))
  p = paintLayer(p, 'level-1', 'collision', (cells) => {
    cells.set(0, 0, 1)
    cells.set(31, 17, 1)
    cells.set(20, 5, 1)
  })
  p = paintLayer(p, 'level-1', 'decor', (cells) => cells.set(31, 17, packTile(51, false, false)))
  p = withLayer(p, 'level-1', 'ground', (layer) =>
    layer.kind === 'auto'
      ? { ...layer, overrides: layer.overrides.set(31, 0, packTile(2, false, false)) }
      : layer,
  )
  return withEntities(p, 'level-1', [entity('coin-1', 'coin', 400, 200)])
}

const level = (p: Project, id = 'level-1'): Level => {
  const found = p.levels.find((candidate) => candidate.id === id)
  if (found === undefined) throw new Error(`no level ${id}`)
  return found
}
const cellsOf = (p: Project, layer: string): Grid => {
  const found = level(p).layers.find((candidate) => candidate.def === layer)
  if (found?.kind === 'auto') return found.overrides
  if (found?.kind === 'tiles' || found?.kind === 'intgrid') return found.cells
  throw new Error(`no cells in ${layer}`)
}
const cellList = (grid: Grid): [number, number][] => grid.nonEmpty().map(({ x, y }) => [x, y])
const itemAt = (p: Project, id: string): [number, number] | undefined => {
  for (const layer of level(p).layers) {
    if (layer.kind !== 'entities' && layer.kind !== 'objects') continue
    const item = layer.items.find((candidate) => candidate.id === id)
    if (item !== undefined) return [item.x, item.y]
  }
  return undefined
}
const placement = (p: Project, id = 'level-1'): Placement | undefined =>
  p.worlds[0]?.placements.find((candidate) => candidate.level === id)
const codes = (p: Project): string[] => checkProject(p, {}).map((d) => d.code)

describe('resizeLevel: growing', () => {
  it('keeps every cell, item and placement, and sizes every grid to the new size', () => {
    const before = project()
    const after = resizeLevel(before, 'level-1', { w: 640, h: 320 }, START)
    expect(level(after).size).toEqual({ w: 640, h: 320 })
    for (const layer of ['collision', 'decor', 'ground']) {
      expect([cellsOf(after, layer).cols, cellsOf(after, layer).rows], layer).toEqual([40, 20])
      expect(cellList(cellsOf(after, layer)), layer).toEqual(cellList(cellsOf(before, layer)))
    }
    expect(itemAt(after, 'coin-1')).toEqual([400, 200])
    expect(placement(after)).toEqual(placement(before))
    expect(resizeLevelLoss(before, 'level-1', { w: 640, h: 320 }, START)).toEqual([])
    expect(codes(after)).toEqual(codes(before))
  })

  it('counts a partial cell at the edge as a cell', () => {
    const after = resizeLevel(project(), 'level-1', { w: 513, h: 289 }, START)
    expect([cellsOf(after, 'collision').cols, cellsOf(after, 'collision').rows]).toEqual([33, 19])
  })

  it('returns the same project for the size it has, whatever the anchor', () => {
    const before = project()
    expect(resizeLevel(before, 'level-1', { w: 512, h: 288 }, END)).toBe(before)
  })
})

describe('resizeLevel: shrinking from the start', () => {
  const SMALL = { w: 320, h: 160 }

  it('drops the cells beyond the new size and lists them per layer for the confirm', () => {
    const before = project()
    expect(resizeLevelLoss(before, 'level-1', SMALL, START)).toEqual([
      { layer: 'decor', count: 1 },
      { layer: 'ground', count: 1 },
      { layer: 'collision', count: 2 },
    ])
    const after = resizeLevel(before, 'level-1', SMALL, START)
    expect(cellList(cellsOf(after, 'collision'))).toEqual([[0, 0]])
    expect(cellList(cellsOf(after, 'decor'))).toEqual([])
    expect([cellsOf(after, 'collision').cols, cellsOf(after, 'collision').rows]).toEqual([20, 10])
  })

  it('keeps an entity outside and the Checks flag it entityOutOfBounds', () => {
    const before = project()
    expect(codes(before)).not.toContain('entityOutOfBounds')
    const after = resizeLevel(before, 'level-1', SMALL, START)
    expect(itemAt(after, 'coin-1')).toEqual([400, 200])
    expect(codes(after).filter((code) => code === 'entityOutOfBounds')).toHaveLength(1)
  })

  it('leaves the old project as it was, so undo restores it', () => {
    const before = project()
    resizeLevel(before, 'level-1', SMALL, START)
    expect(level(before).size).toEqual({ w: 512, h: 288 })
    expect(cellList(cellsOf(before, 'collision'))).toHaveLength(3)
  })
})

describe('resizeLevel: anchors keep the content where it is in the world', () => {
  it('end: moves the content by the change and the placement the other way', () => {
    const after = resizeLevel(project(), 'level-1', { w: 320, h: 160 }, END)
    // Shrunk by 192 × 128 px, which is 12 × 8 cells.
    expect(cellList(cellsOf(after, 'collision'))).toEqual([[19, 9]])
    expect(cellList(cellsOf(after, 'decor'))).toEqual([[19, 9]])
    expect(cellList(cellsOf(after, 'ground'))).toEqual([])
    expect(resizeLevelLoss(project(), 'level-1', { w: 320, h: 160 }, END)).toEqual([
      { layer: 'ground', count: 1 },
      { layer: 'collision', count: 2 },
    ])
    expect(itemAt(after, 'coin-1')).toEqual([208, 72])
    expect(placement(after)).toMatchObject({ x: 192, y: 128 })
  })

  it('centre: moves by half the change, rounded toward zero to whole cells', () => {
    // 32 px wider is 16 px each side, one cell; 6 px taller is under half a cell, so nothing moves up or down.
    const after = resizeLevel(project(), 'level-1', { w: 544, h: 294 }, CENTRE)
    expect(cellList(cellsOf(after, 'collision'))).toEqual([
      [1, 0],
      [21, 5],
      [32, 17],
    ])
    expect(itemAt(after, 'coin-1')).toEqual([416, 200])
    expect(placement(after)).toMatchObject({ x: -16, y: 0 })
  })

  it('centre: rounds a move of one and a half cells down to one', () => {
    const after = resizeLevel(project(), 'level-1', { w: 560, h: 288 }, CENTRE)
    expect(itemAt(after, 'coin-1')).toEqual([416, 200])
  })

  it('moves along one axis only when only that one is anchored away from the start', () => {
    const after = resizeLevel(project(), 'level-1', { w: 512, h: 256 }, { x: 'start', y: 'end' })
    expect(cellList(cellsOf(after, 'collision'))).toEqual([
      [20, 3],
      [31, 15],
    ])
    expect(placement(after)).toMatchObject({ x: 0, y: 32 })
  })

  it("moves an auto layer's manual tiles with the content", () => {
    const after = resizeLevel(project(), 'level-1', { w: 480, h: 288 }, { x: 'end', y: 'start' })
    expect(cellList(cellsOf(after, 'ground'))).toEqual([[29, 0]])
    expect(cellsOf(after, 'ground').get(29, 0)).toBe(packTile(2, false, false))
    expect(resizeLevelLoss(project(), 'level-1', { w: 480, h: 288 }, { x: 'end', y: 'start' })).toEqual([
      { layer: 'collision', count: 1 },
    ])
  })

  it('mixes anchors per axis', () => {
    const after = resizeLevel(project(), 'level-1', { w: 480, h: 288 }, { x: 'end', y: 'start' })
    expect(cellList(cellsOf(after, 'collision'))).toEqual([
      [18, 5],
      [29, 17],
    ])
    expect(placement(after)).toMatchObject({ x: 32, y: 0 })
  })

  it('moves by whole cells of every layer: the least common multiple of their grids', () => {
    const coarse = withDefs(project(), (defs) => ({
      ...defs,
      layers: defs.layers.map((layer) => (layer.id === 'decor' ? { ...layer, grid: 24 } : layer)),
    }))
    // 64 px narrower from the end: a 48 px step (16 and 24) fits once.
    const after = resizeLevel(coarse, 'level-1', { w: 448, h: 288 }, { x: 'end', y: 'start' })
    expect(itemAt(after, 'coin-1')).toEqual([352, 200])
    // Three collision cells to the left: (0, 0) falls off the start and (31, 17) past the new 28 columns.
    expect(cellList(cellsOf(after, 'collision'))).toEqual([[17, 5]])
    expect(placement(after)).toMatchObject({ x: 48, y: 0 })
  })
})

describe('resizeLevel: objects', () => {
  it('moves objects with the content and keeps them', () => {
    const before = hollowmere()
    const village = before.levels.find((candidate) => candidate.id === 'village')
    const props = village?.layers.find((layer) => layer.kind === 'objects')
    const first = props?.kind === 'objects' ? props.items[0] : undefined
    const after = resizeLevel(before, 'village', { w: 160, h: 240 }, { x: 'end', y: 'start' })
    const moved = after.levels
      .find((candidate) => candidate.id === 'village')
      ?.layers.find((l) => l.kind === 'objects')
    expect(
      moved?.kind === 'objects' ? moved.items.map((item) => [item.id, item.x, item.y]) : [],
    ).toContainEqual([first?.id, (first?.x ?? 0) - 160, first?.y])
    expect(moved?.kind === 'objects' ? moved.items : []).toHaveLength(5)
  })
})

describe('resizeLevel: worlds', () => {
  it('lays a sequence out again with the new size', () => {
    const line = setWorldLayout(withNewLevel(project(), 'b', { x: 512, y: 0 }), 'main', 'horizontal')
    const after = resizeLevel(line, 'level-1', { w: 320, h: 288 }, END)
    expect(placement(after)).toMatchObject({ x: 0, y: 0 })
    expect(placement(after, 'b')).toMatchObject({ x: 320, y: 0 })
  })

  it('keeps the level where it is on a grid map: the content moves by whole world grid steps', () => {
    const grid = setWorldLayout(project(), 'main', 'grid', { w: 64, h: 64 })
    // 32 px narrower from the end is half a 64 px grid step: nothing may move, on the map or inside the level.
    const after = resizeLevel(grid, 'level-1', { w: 480, h: 288 }, { x: 'end', y: 'start' })
    expect(placement(after)).toMatchObject({ x: 0, y: 0 })
    expect(itemAt(after, 'coin-1')).toEqual([400, 200])
    // 128 px narrower is two grid steps: the content moves 128 px left and the level 128 px right, so both stay put.
    const two = resizeLevel(grid, 'level-1', { w: 384, h: 288 }, { x: 'end', y: 'start' })
    expect(placement(two)).toMatchObject({ x: 128, y: 0 })
    expect(itemAt(two, 'coin-1')).toEqual([272, 200])
  })
})

describe('resizeLevel: refusals', () => {
  it('throws RangeError past the guard rails and for an unknown level', () => {
    for (const size of [
      { w: 0, h: 100 },
      { w: 100.5, h: 100 },
      { w: 16385, h: 100 },
    ]) {
      expect(() => resizeLevel(project(), 'level-1', size, START), JSON.stringify(size)).toThrow(RangeError)
      expect(() => resizeLevelLoss(project(), 'level-1', size, START)).toThrow(RangeError)
    }
    expect(() => resizeLevel(project(), 'nope', { w: 10, h: 10 }, START)).toThrow(/no level "nope"/)
  })
})

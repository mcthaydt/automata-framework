import { describe, expect, it } from 'vitest'
import { emptyLayers, layerCells } from './level-layers'
import type { LayerDef } from './project-types'

const defs: LayerDef[] = [
  { id: 'entities', label: 'Entities', kind: 'entities', grid: 16, snap: true },
  { id: 'props', label: 'Props', kind: 'objects', tileset: 'terrain', snap: 0 },
  {
    id: 'art',
    label: 'Art',
    kind: 'auto',
    grid: 16,
    source: 'collision',
    tileset: 'terrain',
    groups: [],
    opacity: 1,
  },
  { id: 'decor', label: 'Decor', kind: 'tiles', grid: 8, tileset: 'terrain', opacity: 1 },
  { id: 'collision', label: 'Collision', kind: 'intgrid', grid: 16, values: [], opacity: 1 },
]

describe('layerCells', () => {
  it('is the number of cells that cover each side', () => {
    expect(layerCells({ w: 512, h: 288 }, 16)).toEqual({ cols: 32, rows: 18 })
    expect(layerCells({ w: 100, h: 33 }, 16)).toEqual({ cols: 7, rows: 3 })
  })
})

describe('emptyLayers', () => {
  const layers = emptyLayers(defs, { w: 100, h: 40 })

  it('holds one instance per definition, in the definitions order, of the definition kind', () => {
    expect(layers.map((layer) => [layer.def, layer.kind])).toEqual([
      ['entities', 'entities'],
      ['props', 'objects'],
      ['art', 'auto'],
      ['decor', 'tiles'],
      ['collision', 'intgrid'],
    ])
  })

  it('sizes each grid by its own cell size', () => {
    const decor = layers[3]
    const collision = layers[4]
    if (decor?.kind !== 'tiles' || collision?.kind !== 'intgrid') throw new Error('unexpected kinds')
    expect([decor.cells.cols, decor.cells.rows]).toEqual([13, 5])
    expect([collision.cells.cols, collision.cells.rows]).toEqual([7, 3])
    expect(decor.cells.nonEmpty()).toEqual([])
  })

  it('starts an auto layer at seed 1 with no overrides, and entity and object layers with no items', () => {
    const art = layers[2]
    if (art?.kind !== 'auto') throw new Error('not an auto layer')
    expect(art.seed).toBe(1)
    expect([art.overrides.cols, art.overrides.rows, art.overrides.nonEmpty()]).toEqual([7, 3, []])
    expect(layers[0]).toEqual({ def: 'entities', kind: 'entities', items: [] })
    expect(layers[1]).toEqual({ def: 'props', kind: 'objects', items: [] })
  })
})

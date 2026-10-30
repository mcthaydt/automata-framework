import { describe, expect, it } from 'vitest'
import type { Project } from '../../model/project-types'
import { drawView, richProject } from '../../testing/draw-fixtures'
import { withDefs } from '../../testing/project-edit'
import type { DrawView } from './draw-list-types'
import { createLevelDrawList } from './level-draw-list'

// Overlays on the rich fixture's level `start` (64 × 48 px, 16 px cells: 4 × 3), whose entities are a player start
// (box 8, 16, 16 × 16), a slime (20, 16, 24 × 16) and a door (40, 0, 16 × 32).

const noImages: ReadonlySet<string> = new Set()

function overlays(patch: Partial<DrawView>, project: Project = richProject()) {
  const { grid, footprint, selection } = createLevelDrawList()({
    project,
    view: drawView(patch),
    images: noImages,
  })
  return { grid, footprint, selection }
}

describe('overlays: the grid', () => {
  it('draws the active layer’s grid from 0 to the level’s edge', () => {
    expect(overlays({}).grid).toEqual({ step: 16, xs: [0, 16, 32, 48, 64], ys: [0, 16, 32, 48] })
    expect(overlays({ layer: 'entities' }).grid?.step).toBe(16)
  })

  it('ends on the edge when the level is not a whole number of cells', () => {
    const project = richProject()
    const odd = {
      ...project,
      levels: project.levels.map((level) =>
        level.id === 'start' ? { ...level, size: { w: 40, h: 20 } } : level,
      ),
    }
    expect(overlays({}, odd).grid).toEqual({ step: 16, xs: [0, 16, 32, 40], ys: [0, 16, 20] })
  })

  it('draws an objects layer’s grid by its snap, and none for free placement', () => {
    expect(overlays({ layer: 'props' }).grid).toBeUndefined()
    const snapped = withDefs(richProject(), (defs) => ({
      ...defs,
      layers: defs.layers.map((def) => (def.kind === 'objects' ? { ...def, snap: 32 } : def)),
    }))
    expect(overlays({ layer: 'props' }, snapped).grid).toEqual({ step: 32, xs: [0, 32, 64], ys: [0, 32, 48] })
  })
  it('draws no grid for an entities layer that does not snap, as an objects layer that places freely', () => {
    const free = withDefs(richProject(), (defs) => ({
      ...defs,
      layers: defs.layers.map((def) => (def.kind === 'entities' ? { ...def, snap: false } : def)),
    }))
    expect(overlays({ layer: 'entities' }, free).grid).toBeUndefined()
  })
})

describe('overlays: the footprint', () => {
  it('shows the brush square at the hover cell, on every cell layer', () => {
    for (const layer of ['decor', 'collision', 'ground-art']) {
      expect(overlays({ layer, hover: { x: 1, y: 1 } }).footprint, layer).toEqual({
        x: 16,
        y: 16,
        w: 16,
        h: 16,
        erase: false,
      })
    }
    expect(overlays({ hover: { x: 1, y: 1 }, brushSize: 2 }).footprint).toEqual({
      x: 16,
      y: 16,
      w: 32,
      h: 32,
      erase: false,
    })
    expect(overlays({ hover: { x: 1, y: 1 }, brushSize: 3 }).footprint).toMatchObject({
      x: 0,
      y: 0,
      w: 48,
      h: 48,
    })
  })

  it('clips the square to the layer, and shows nothing when it is all outside', () => {
    expect(overlays({ hover: { x: 3, y: 2 }, brushSize: 3 }).footprint).toMatchObject({
      x: 32,
      y: 16,
      w: 32,
      h: 32,
    })
    expect(overlays({ hover: { x: 0, y: 0 }, brushSize: 4 }).footprint).toMatchObject({
      x: 0,
      y: 0,
      w: 48,
      h: 48,
    })
    expect(overlays({ hover: { x: 9, y: 9 } }).footprint).toBeUndefined()
  })

  it('marks the eraser’s footprint', () => {
    expect(overlays({ tool: 'eraser', hover: { x: 2, y: 0 }, brushSize: 2 }).footprint).toEqual({
      x: 32,
      y: 0,
      w: 32,
      h: 32,
      erase: true,
    })
  })

  it('shows the live rectangle, with its corners in either order, or the hover cell before it starts', () => {
    expect(overlays({ tool: 'rectangle', hover: { x: 2, y: 1 } }).footprint).toMatchObject({
      x: 32,
      y: 16,
      w: 16,
      h: 16,
    })
    const live = { from: { x: 3, y: 2 }, to: { x: 1, y: 0 } }
    expect(overlays({ tool: 'rectangle', rectangle: live, hover: { x: 1, y: 0 } }).footprint).toEqual({
      x: 16,
      y: 0,
      w: 48,
      h: 48,
      erase: false,
    })
    const beyond = { from: { x: 2, y: 1 }, to: { x: 8, y: 8 } }
    expect(overlays({ tool: 'rectangle', rectangle: beyond }).footprint).toMatchObject({
      x: 32,
      y: 16,
      w: 32,
      h: 32,
    })
  })

  it('shows one cell for fill and picker, whatever the brush size, and nothing for select', () => {
    for (const tool of ['fill', 'picker'] as const) {
      expect(overlays({ tool, hover: { x: 1, y: 2 }, brushSize: 4 }).footprint, tool).toMatchObject({
        x: 16,
        y: 32,
        w: 16,
        h: 16,
      })
    }
    expect(overlays({ tool: 'select', hover: { x: 1, y: 2 } }).footprint).toBeUndefined()
  })

  it('shows nothing without a hover cell, on an entities or objects layer, or on a locked or hidden layer', () => {
    expect(overlays({}).footprint).toBeUndefined()
    expect(overlays({ layer: 'entities', hover: { x: 1, y: 1 } }).footprint).toBeUndefined()
    expect(overlays({ layer: 'props', hover: { x: 1, y: 1 } }).footprint).toBeUndefined()
    expect(overlays({ hover: { x: 1, y: 1 }, locked: new Set(['decor']) }).footprint).toBeUndefined()
    expect(overlays({ hover: { x: 1, y: 1 }, hidden: new Set(['decor']) }).footprint).toBeUndefined()
    expect(overlays({ hover: { x: 1, y: 1 }, locked: new Set(['collision']) }).footprint).toBeDefined()
  })
})

describe('overlays: the selection', () => {
  it('outlines each selected entity’s box, in the order selected', () => {
    expect(overlays({ layer: 'entities', selected: ['0000000c', '00000009'] }).selection).toEqual([
      { id: '0000000c', x: 40, y: 0, w: 16, h: 32 },
      { id: '00000009', x: 8, y: 16, w: 16, h: 16 },
    ])
  })

  it('skips ids that are gone, that are not entities, or that sit on a hidden layer', () => {
    expect(overlays({ selected: ['missing', '0000000b', '0000000a'] }).selection).toEqual([
      { id: '0000000a', x: 20, y: 16, w: 24, h: 16 },
    ])
    expect(overlays({ selected: ['0000000a'], hidden: new Set(['entities']) }).selection).toEqual([])
    expect(overlays({}).selection).toEqual([])
  })
})

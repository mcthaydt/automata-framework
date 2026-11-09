import { describe, expect, it } from 'vitest'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import type { Project } from '#src/shared/level-2d/model/project-types.ts'
import {
  copyLevelInput,
  dragPosition,
  fitWorld,
  levelAt,
  levelsOnScreen,
  linksInto,
  newLevelInput,
  toWorld,
  uncoveredArea,
  worldRects,
} from '#src/shared/level-2d/model/world/world-model.ts'
import { platformerTemplate } from '#src/shared/level-2d/profiles/level-project/templates/platformer.ts'
import { linkedMaps } from '#src/testing/level-2d/linked-maps.ts'
import { entity, withEntities, withNewLevel } from '#src/testing/level-2d/project-edit.ts'

const project = (): Project => {
  const base = platformerTemplate.create(counterIds())
  // A second level to the right, and a third over the first, drawn above it.
  return withNewLevel(withNewLevel(base, 'level-2', { x: 600, y: 0 }), 'level-3', { x: 100, y: 50, depth: 1 })
}

describe('worldRects', () => {
  it("draws each placed level at its position with its size, lowest depth first, then the world's order", () => {
    const p = project()
    const [first] = p.levels
    const size = first?.size ?? { w: 0, h: 0 }
    const rects = worldRects(p, 'main', 'level-2')
    expect(rects.map((rect) => rect.id)).toEqual([first?.id, 'level-2', 'level-3'])
    expect(rects[1]).toEqual({
      id: 'level-2',
      name: expect.any(String),
      x: 600,
      y: 0,
      w: size.w,
      h: size.h,
      depth: 0,
      selected: true,
    })
    expect(rects[2]?.depth).toBe(1)
    expect(rects.filter((rect) => rect.selected)).toHaveLength(1)
  })

  it('refuses a world that is not there', () => {
    expect(() => worldRects(project(), 'gone', undefined)).toThrow(RangeError)
  })
})

describe('fitWorld', () => {
  it('shows every level, as large as fits inside the margin, centred', () => {
    const rects = worldRects(project(), 'main', undefined)
    const right = Math.max(...rects.map((rect) => rect.x + rect.w))
    const bottom = Math.max(...rects.map((rect) => rect.y + rect.h))
    const camera = fitWorld(rects, { w: 800, h: 600 }, 20)
    const scale = Math.min(760 / right, 560 / bottom)
    expect(camera.scale).toBeCloseTo(scale, 9)
    // The world's box is centred in the canvas.
    expect(camera.x + (right * camera.scale) / 2).toBeCloseTo(400, 6)
    expect(camera.y + (bottom * camera.scale) / 2).toBeCloseTo(300, 6)
  })

  it('shows an empty world at scale 1 from the margin', () => {
    expect(fitWorld([], { w: 800, h: 600 }, 20)).toEqual({ x: 20, y: 20, scale: 1 })
  })
})

describe('levelAt', () => {
  it('finds the topmost level under a world point, and nothing on empty space', () => {
    const rects = worldRects(project(), 'main', undefined)
    const first = rects[0]?.id
    expect(levelAt(rects, { x: 10, y: 10 })).toBe(first)
    // level-3 has depth 1 and covers part of the first level.
    expect(levelAt(rects, { x: 120, y: 60 })).toBe('level-3')
    expect(levelAt(rects, { x: 610, y: 5 })).toBe('level-2')
    expect(levelAt(rects, { x: 590, y: 1000 })).toBeUndefined()
  })
})

describe('toWorld and dragPosition', () => {
  it('turns a screen point and a screen travel into world pixels by the camera', () => {
    const camera = { x: 20, y: 10, scale: 0.5 }
    expect(toWorld(camera, { x: 70, y: 60 })).toEqual({ x: 100, y: 100 })
    expect(dragPosition({ x: 600, y: 0 }, { x: 25, y: -12.6 }, camera.scale)).toEqual({ x: 650, y: -25 })
  })
})

describe('newLevelInput (Add level, plan ED2D.6c decision 6)', () => {
  it('names the next free level, the size of the first, right of the rightmost with a gap, at the top', () => {
    const base = platformerTemplate.create(counterIds())
    const size = base.levels[0]?.size ?? { w: 0, h: 0 }
    expect(newLevelInput(base, 'main')).toEqual({
      id: 'level-2',
      name: 'Level 2',
      world: 'main',
      x: size.w + 32,
      y: 0,
      size,
    })
    // level-2 and level-3 are taken: the next is level-4, right of level-2 (at 600) and its width.
    expect(newLevelInput(project(), 'main')).toMatchObject({
      id: 'level-4',
      name: 'Level 4',
      x: 600 + size.w + 32,
    })
  })
})

describe('copyLevelInput and linksInto (Duplicate and Remove, plan ED2D.8a decision 3)', () => {
  it('names a copy "<name> copy" with the first free "<id>-copy" id', () => {
    const p = project()
    expect(copyLevelInput(p, 'level-2')).toEqual({ id: 'level-2-copy', name: 'level-2 copy' })
    const copied = withNewLevel(p, 'level-2-copy', { x: 0, y: 900 })
    expect(copyLevelInput(copied, 'level-2')).toEqual({ id: 'level-2-copy-2', name: 'level-2 copy' })
  })

  it('counts the links from other levels that lead into a level', () => {
    const p = linkedMaps()
    expect(linksInto(p, 'inn')).toBe(1)
    const withWarp = withEntities(p, 'inn', [
      entity('warp-1', 'warp', 10, 10, { target: { target: 'door-in', container: 'inn' } }),
    ])
    expect(linksInto(withWarp, 'inn')).toBe(1)
    expect(linksInto(p, 'map-1')).toBe(1)
  })
})

describe('uncoveredArea (plan ED2D.8b decision 2)', () => {
  const map = { x: 0, y: 100, w: 800, h: 1000 }
  it('is the whole map when nothing covers it', () => {
    expect(uncoveredArea(map, [])).toEqual({ x: 0, y: 0, w: 800, h: 1000 })
  })
  it('leaves out a drawer from the left or the right, and a sheet from the bottom, in map coordinates', () => {
    expect(uncoveredArea(map, [{ x: 0, y: 50, w: 300, h: 1100 }])).toEqual({ x: 300, y: 0, w: 500, h: 1000 })
    expect(uncoveredArea(map, [{ x: 500, y: 50, w: 400, h: 1100 }])).toEqual({ x: 0, y: 0, w: 500, h: 1000 })
    expect(uncoveredArea(map, [{ x: 0, y: 700, w: 800, h: 500 }])).toEqual({ x: 0, y: 0, w: 800, h: 600 })
  })
  it('ignores a cover that misses the map, and never goes below nothing', () => {
    expect(uncoveredArea(map, [{ x: 900, y: 0, w: 100, h: 100 }])).toEqual({ x: 0, y: 0, w: 800, h: 1000 })
    expect(uncoveredArea(map, [{ x: -10, y: 0, w: 900, h: 2000 }]).w).toBe(0)
  })
})

describe('levelsOnScreen (where the layout checks find the levels)', () => {
  const rect = (x: number, y: number) => ({
    id: `${x}`,
    name: '',
    x,
    y,
    w: 10,
    h: 20,
    depth: 0,
    selected: false,
  })

  it("gives the levels' outer edges on screen, through the camera", () => {
    expect(levelsOnScreen([rect(0, 0), rect(30, 40)], { x: 5, y: 7, scale: 2 })).toEqual({
      across: '5,85',
      down: '7,127',
    })
  })

  it('gives nothing for an empty world', () => {
    expect(levelsOnScreen([], { x: 0, y: 0, scale: 1 })).toBeUndefined()
  })
})

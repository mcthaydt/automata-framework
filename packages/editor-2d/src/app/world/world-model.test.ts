import { describe, expect, it } from 'vitest'
import { counterIds } from '../../model/ids'
import type { Project } from '../../model/project-types'
import { platformerTemplate } from '../../profiles/level-project/templates/platformer'
import { withNewLevel } from '../../testing/project-edit'
import { dragPosition, fitWorld, levelAt, toWorld, worldRects } from './world-model'

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

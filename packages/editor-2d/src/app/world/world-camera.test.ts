import { describe, expect, it } from 'vitest'
import { createWorldCamera } from './world-camera'
import type { WorldRect } from './world-model'

const rect = (id: string, x: number): WorldRect => ({
  id,
  name: id,
  x,
  y: 0,
  w: 400,
  h: 300,
  depth: 0,
  selected: false,
})
// 1000 × 300 world px in an 800 × 600 box with 24 px of margin: (800 - 48) / 1000 = 0.752.
const RECTS = [rect('a', 0), rect('b', 600)]
const BOX = { w: 800, h: 600 }

describe('the World view camera (plan ED2D.8a decision 2)', () => {
  it('has no camera until it is measured, then fits every level inside the margin, centred', () => {
    const camera = createWorldCamera()
    expect(camera.camera).toBeUndefined()
    camera.measure(BOX, RECTS)
    expect(camera.camera?.scale).toBeCloseTo(0.752)
    expect(camera.camera?.x).toBeCloseTo(24)
    expect(camera.camera?.y).toBeCloseTo((600 - 300 * 0.752) / 2)
  })

  it('pans, zooms about a point, and fits again', () => {
    const camera = createWorldCamera()
    camera.measure(BOX, RECTS)
    const fitted = camera.camera
    camera.panBy(10, -5)
    expect(camera.camera?.x).toBeCloseTo((fitted?.x ?? 0) + 10)
    expect(camera.camera?.y).toBeCloseTo((fitted?.y ?? 0) - 5)
    const under = camera.toWorld({ x: 400, y: 300 })
    camera.zoomAt({ x: 400, y: 300 }, 2)
    expect(camera.camera?.scale).toBeCloseTo(1.504)
    expect(camera.toWorld({ x: 400, y: 300 }).x).toBeCloseTo(under.x)
    camera.fit(RECTS)
    expect(camera.camera).toEqual(fitted)
  })

  it('keeps the centre on a new box, and tells its listeners each move', () => {
    const camera = createWorldCamera()
    let moves = 0
    camera.subscribe(() => moves++)
    camera.measure(BOX, RECTS)
    const centre = camera.toWorld({ x: 400, y: 300 })
    camera.measure({ w: 400, h: 600 }, RECTS)
    expect(camera.toWorld({ x: 200, y: 300 }).x).toBeCloseTo(centre.x)
    expect(moves).toBe(2)
  })

  it('fits an empty world to the box at 100 %', () => {
    const camera = createWorldCamera()
    camera.measure(BOX, [])
    expect(camera.camera).toEqual({ x: 0, y: 0, scale: 1 })
  })
})

import { describe, expect, test } from 'vitest'
import { createViewport, type Viewport2D } from '#src/shared/kit/gestures/viewport-2d.ts'

const SIZE = { w: 800, h: 600 }

/** A small deterministic generator, so the property tests are the same on every run and every engine. */
function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

function randomViewport(next: () => number): Viewport2D {
  return createViewport({
    size: SIZE,
    pan: { x: next() * 800 - 400, y: next() * 600 - 300 },
    zoom: 2 ** (next() * 8 - 4),
  })
}

describe('createViewport', () => {
  test('starts at zoom 1 with the world origin at the top left', () => {
    const viewport = createViewport({ size: SIZE })
    expect(viewport.zoom).toBe(1)
    expect(viewport.pan).toEqual({ x: 0, y: 0 })
    expect(viewport.size).toEqual(SIZE)
    expect(viewport.limits).toEqual({ minZoom: 1 / 32, maxZoom: 64, keep: 64 })
  })

  test('screenToWorld and worldToScreen are inverses for random pans and zooms', () => {
    const next = seeded(7)
    for (let i = 0; i < 200; i++) {
      const viewport = randomViewport(next)
      const point = { x: next() * 800, y: next() * 600 }
      const back = viewport.worldToScreen(viewport.screenToWorld(point))
      expect(back.x).toBeCloseTo(point.x, 6)
      expect(back.y).toBeCloseTo(point.y, 6)
    }
  })

  test('the conversions follow pan and zoom: world (10, 20) at zoom 2 and pan (5, 7) is screen (25, 47)', () => {
    const viewport = createViewport({ size: SIZE, pan: { x: 5, y: 7 }, zoom: 2 })
    expect(viewport.worldToScreen({ x: 10, y: 20 })).toEqual({ x: 25, y: 47 })
    expect(viewport.screenToWorld({ x: 25, y: 47 })).toEqual({ x: 10, y: 20 })
  })

  test('a start zoom outside the limits is clamped', () => {
    expect(createViewport({ size: SIZE, zoom: 1000 }).zoom).toBe(64)
    expect(createViewport({ size: SIZE, zoom: 0 }).zoom).toBe(1 / 32)
  })

  test('every method returns a new viewport and leaves the old one unchanged', () => {
    const viewport = createViewport({ size: SIZE })
    const moved = viewport.panBy(10, 20)
    const zoomed = viewport.zoomAt({ x: 100, y: 100 }, 2)
    const fitted = viewport.fit({ x: 0, y: 0, w: 100, h: 100 })
    const resized = viewport.resize({ w: 400, h: 300 })
    expect(new Set([viewport, moved, zoomed, fitted, resized]).size).toBe(5)
    expect(viewport.pan).toEqual({ x: 0, y: 0 })
    expect(viewport.zoom).toBe(1)
    expect(viewport.size).toEqual(SIZE)
  })
})

describe('panBy', () => {
  test('moves the content with the pointer: the world slides by the screen delta', () => {
    const viewport = createViewport({ size: SIZE, pan: { x: 5, y: 5 } }).panBy(10, -3)
    expect(viewport.pan).toEqual({ x: 15, y: 2 })
  })
})

describe('zoomAt', () => {
  test('keeps the world point under the screen point fixed', () => {
    const next = seeded(11)
    for (let i = 0; i < 200; i++) {
      const viewport = randomViewport(next)
      const point = { x: next() * 800, y: next() * 600 }
      const before = viewport.screenToWorld(point)
      const factor = 2 ** (next() * 2 - 1)
      const zoomed = viewport.zoomAt(point, factor)
      if (zoomed.zoom === viewport.zoom * factor) {
        const after = zoomed.screenToWorld(point)
        expect(after.x).toBeCloseTo(before.x, 6)
        expect(after.y).toBeCloseTo(before.y, 6)
      }
    }
  })

  test('keeps the world point fixed when the limit clamps the zoom too', () => {
    const viewport = createViewport({ size: SIZE, pan: { x: 40, y: 10 }, zoom: 2 })
    const point = { x: 300, y: 250 }
    const before = viewport.screenToWorld(point)
    for (const factor of [1000, 1e-9]) {
      const after = viewport.zoomAt(point, factor).screenToWorld(point)
      expect(after.x).toBeCloseTo(before.x, 9)
      expect(after.y).toBeCloseTo(before.y, 9)
    }
  })

  test('multiplies the zoom by the factor and clamps at both limits', () => {
    const viewport = createViewport({ size: SIZE, zoom: 2 })
    expect(viewport.zoomAt({ x: 0, y: 0 }, 1.5).zoom).toBe(3)
    expect(viewport.zoomAt({ x: 0, y: 0 }, 1000).zoom).toBe(64)
    expect(viewport.zoomAt({ x: 0, y: 0 }, 1e-9).zoom).toBe(1 / 32)
  })

  test('a custom zoom limit replaces the default', () => {
    const viewport = createViewport({ size: SIZE, limits: { minZoom: 0.5, maxZoom: 4 } })
    expect(viewport.zoomAt({ x: 0, y: 0 }, 100).zoom).toBe(4)
    expect(viewport.zoomAt({ x: 0, y: 0 }, 0.01).zoom).toBe(0.5)
  })
})

describe('snapZoom', () => {
  test('leaves a zoom of 1 or less alone', () => {
    for (const zoom of [1 / 3, 0.77, 1]) {
      expect(createViewport({ size: SIZE, zoom }).snapZoom({ x: 0, y: 0 }).zoom).toBe(zoom)
    }
  })

  test('rounds a zoom above 1 to the nearest 1/8 about the point, which stays fixed', () => {
    const viewport = createViewport({ size: SIZE, pan: { x: 30, y: 40 }, zoom: 2.07 })
    const point = { x: 300, y: 200 }
    const before = viewport.screenToWorld(point)
    const snapped = viewport.snapZoom(point)
    expect(snapped.zoom).toBe(2.125)
    expect(snapped.screenToWorld(point).x).toBeCloseTo(before.x, 9)
    expect(snapped.screenToWorld(point).y).toBeCloseTo(before.y, 9)
    expect(createViewport({ size: SIZE, zoom: 1.04 }).snapZoom(point).zoom).toBe(1)
  })
})

describe('fit', () => {
  test('centres the rect at the largest zoom that shows all of it, less the padding', () => {
    const viewport = createViewport({ size: { w: 800, h: 600 } }).fit({ x: 100, y: 50, w: 400, h: 100 }, 20)
    expect(viewport.zoom).toBe(1.9)
    const centre = viewport.worldToScreen({ x: 300, y: 100 })
    expect(centre.x).toBeCloseTo(400, 9)
    expect(centre.y).toBeCloseTo(300, 9)
  })

  test('is limited by the height when the rect is tall', () => {
    const viewport = createViewport({ size: { w: 800, h: 600 } }).fit({ x: 0, y: 0, w: 100, h: 1000 })
    expect(viewport.zoom).toBeCloseTo(0.6)
  })

  test('stays within the zoom limits, and an empty rect or a padding wider than the view leaves a legal zoom', () => {
    const tiny = createViewport({ size: SIZE }).fit({ x: 0, y: 0, w: 1, h: 1 })
    expect(tiny.zoom).toBe(64)
    const crowded = createViewport({ size: SIZE }).fit({ x: 0, y: 0, w: 100, h: 100 }, 1000)
    expect(crowded.zoom).toBe(1 / 32)
    const empty = createViewport({ size: SIZE, zoom: 3 }).fit({ x: 5, y: 5, w: 0, h: 0 })
    expect(empty.zoom).toBe(3)
  })
})

describe('resize', () => {
  test('keeps the world point at the centre of the view', () => {
    const next = seeded(23)
    for (let i = 0; i < 100; i++) {
      const viewport = randomViewport(next)
      const centre = viewport.screenToWorld({ x: SIZE.w / 2, y: SIZE.h / 2 })
      const resized = viewport.resize({ w: 300 + next() * 900, h: 300 + next() * 600 })
      const now = resized.worldToScreen(centre)
      expect(now.x).toBeCloseTo(resized.size.w / 2, 6)
      expect(now.y).toBeCloseTo(resized.size.h / 2, 6)
    }
  })
})

describe('bounds', () => {
  const bounds = { x: 0, y: 0, w: 512, h: 288 }

  test('keep px of the level stay on the screen: a pan beyond the edge stops there', () => {
    const viewport = createViewport({ size: SIZE, limits: { bounds, keep: 64 } })
    expect(viewport.panBy(-5000, 0).pan.x).toBe(64 - 512)
    expect(viewport.panBy(5000, 0).pan.x).toBe(800 - 64)
    expect(viewport.panBy(0, -5000).pan.y).toBe(64 - 288)
    expect(viewport.panBy(0, 5000).pan.y).toBe(600 - 64)
  })

  test('the limit follows the zoom, and a level smaller than keep stays fully on the screen', () => {
    const zoomed = createViewport({ size: SIZE, zoom: 2, limits: { bounds, keep: 64 } })
    expect(zoomed.panBy(-5000, 0).pan.x).toBe(64 - 1024)
    const small = createViewport({ size: SIZE, limits: { bounds: { x: 0, y: 0, w: 20, h: 20 }, keep: 64 } })
    expect(small.panBy(-5000, 0).pan.x).toBe(20 - 20)
    expect(small.panBy(5000, 0).pan.x).toBe(800 - 20)
  })

  test('zooming and fitting also respect the bounds', () => {
    const viewport = createViewport({ size: SIZE, limits: { bounds, keep: 64 } })
    const zoomed = viewport.zoomAt({ x: 0, y: 0 }, 8)
    expect(zoomed.pan.x).toBeLessThanOrEqual(800 - 64)
    expect(zoomed.pan.x).toBeGreaterThanOrEqual(64 - 512 * 8)
    const fitted = viewport.fit({ x: 10000, y: 10000, w: 10, h: 10 })
    expect(fitted.pan.x).toBeGreaterThanOrEqual(64 - 512 * fitted.zoom)
    expect(fitted.pan.x).toBeLessThanOrEqual(800 - 64)
  })
})

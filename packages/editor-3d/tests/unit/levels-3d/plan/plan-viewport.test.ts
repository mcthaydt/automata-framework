// The plan's camera, its grid and its snap values (ED3D.4 step 1): the kit's `Viewport2D` driven by the view state's
// camera, and the snap and snap step with the cases its tests hold.
import { createViewport } from '@automata/editor/kit/core'
import { describe, expect, it } from 'vitest'
import {
  cameraOf,
  fitInto,
  fitPlan,
  gridLines,
  gridStep,
  levelBounds,
  PLAN_LIMITS,
  PLAN_PX_PER_M,
  planViewport,
  snapStep,
  snapValue,
  toScreen,
  toWorld,
} from '#src/features/levels-3d/plan/plan-viewport.ts'
import { afSectorProfile } from '#src/shared/level-session/af-sector-profile.ts'
import { toyAfSector } from '#src/testing/toy-af-sector.ts'

const size = { w: 600, h: 400 }

describe('planViewport', () => {
  it('puts the camera centre in the middle of the canvas, 32 px to a metre at zoom 1, z down the screen', () => {
    const viewport = planViewport({ x: 0, z: 0, zoom: 1 }, size)
    expect(PLAN_PX_PER_M).toBe(32)
    expect(toScreen(viewport, { x: 0, z: 0 })).toEqual({ x: 300, y: 200 })
    expect(toScreen(viewport, { x: 1, z: 0 })).toEqual({ x: 332, y: 200 })
    expect(toScreen(viewport, { x: 0, z: 1 })).toEqual({ x: 300, y: 232 })
  })

  it('centres on the camera point and scales by the zoom', () => {
    const viewport = planViewport({ x: 2, z: -1, zoom: 2 }, size)
    expect(toScreen(viewport, { x: 2, z: -1 })).toEqual({ x: 300, y: 200 })
    expect(toScreen(viewport, { x: 3, z: -1 })).toEqual({ x: 364, y: 200 })
    expect(toScreen(viewport, { x: 2, z: 0 })).toEqual({ x: 300, y: 264 })
  })

  it('reads the camera back, for centres and zooms of every kind', () => {
    for (const camera of [
      { x: 0, z: 0, zoom: 1 },
      { x: 2, z: -1, zoom: 2 },
      { x: -13.25, z: 7.5, zoom: 0.5 },
      { x: 100, z: -100, zoom: 12.5 },
    ]) {
      const back = cameraOf(planViewport(camera, size))
      expect(back.x).toBeCloseTo(camera.x, 9)
      expect(back.z).toBeCloseTo(camera.z, 9)
      expect(back.zoom).toBeCloseTo(camera.zoom, 12)
    }
  })

  it('keeps the zoom between 4 and 400 px to a metre, as Last Light does', () => {
    expect(PLAN_LIMITS).toMatchObject({ minZoom: 4, maxZoom: 400 })
    expect(cameraOf(planViewport({ x: 0, z: 0, zoom: 0.01 }, size)).zoom).toBeCloseTo(4 / 32, 12)
    expect(cameraOf(planViewport({ x: 0, z: 0, zoom: 100 }, size)).zoom).toBeCloseTo(400 / 32, 12)
  })

  it('turns a screen point into the world point it shows, and back', () => {
    const viewport = planViewport({ x: 2, z: -1, zoom: 2 }, size)
    const world = toWorld(viewport, { x: 364, y: 264 })
    expect(world.x).toBeCloseTo(3, 9)
    expect(world.z).toBeCloseTo(0, 9)
    const there = toScreen(viewport, { x: 5.5, z: -3.25 })
    expect(toWorld(viewport, there)).toEqual({ x: 5.5, z: -3.25 })
  })
})

describe('levelBounds and fitPlan', () => {
  const layersOf = (level: ReturnType<typeof toyAfSector>) => afSectorProfile.geometry(level).layers

  it('covers the corners of every sector', () => {
    expect(levelBounds(layersOf(toyAfSector()))).toEqual({ x: 0, y: 0, w: 14, h: 6 })
    // Bounds are the corners' extremes, whatever the shape: an L of two sectors reaches the far corner of each.
    const bent = toyAfSector({
      sectors: [
        {
          id: 'a',
          floor: 0,
          ceiling: 3,
          light: 1,
          corners: [
            [-2, 1],
            [3, 1],
            [3, 4],
            [-2, 4],
          ],
        },
        {
          id: 'b',
          floor: 0,
          ceiling: 3,
          light: 1,
          corners: [
            [3, 4],
            [5, 4],
            [5, 9],
            [3, 9],
          ],
        },
      ],
    })
    expect(levelBounds(layersOf(bent))).toEqual({ x: -2, y: 1, w: 7, h: 8 })
  })

  it('is the 10 m box round the origin for a level with no sector, as in Last Light', () => {
    expect(levelBounds([])).toEqual({ x: -5, y: -5, w: 10, h: 10 })
    expect(levelBounds(layersOf(toyAfSector({ sectors: [] })))).toEqual({ x: -5, y: -5, w: 10, h: 10 })
  })

  it("fits the bounds in the canvas inside the padding (Last Light's case: -5..5 by -7..7 in 600 by 400, 20 px)", () => {
    const camera = fitPlan({ x: -5, y: -7, w: 10, h: 14 }, size, 20)
    expect(camera.x).toBeCloseTo(0, 9)
    expect(camera.z).toBeCloseTo(0, 9)
    // The 14 m height fills the 360 px that are left: the width has room to spare.
    expect(camera.zoom * PLAN_PX_PER_M * 14).toBeCloseTo(360, 6)
    const viewport = planViewport(camera, size)
    expect(toScreen(viewport, { x: 0, z: -7 }).y).toBeCloseTo(20, 6)
    expect(toScreen(viewport, { x: 0, z: 7 }).y).toBeCloseTo(380, 6)
  })

  it('centres bounds that are off the origin, and pads 24 px by default', () => {
    const camera = fitPlan({ x: 10, y: 20, w: 8, h: 4 }, size)
    expect(camera.x).toBeCloseTo(14, 9)
    expect(camera.z).toBeCloseTo(22, 9)
    expect(camera.zoom * PLAN_PX_PER_M * 8).toBeCloseTo(600 - 48, 6)
  })

  it('does not zoom past the limits for a speck, and fits a level the size of one point', () => {
    expect(fitPlan({ x: 3, y: 3, w: 0, h: 0 }, size).zoom).toBeGreaterThan(0)
    expect(fitPlan({ x: 0, y: 0, w: 0.01, h: 0.01 }, size).zoom * PLAN_PX_PER_M).toBe(400)
  })
})

describe('gridStep and gridLines', () => {
  it('shows the base step while it is at least 16 px apart, and doubles it zoomed out (ED3D-D11: 0.25 m, 0.5 m zoomed out)', () => {
    expect(gridStep(0.25, 64)).toBe(0.25)
    expect(gridStep(0.25, 63)).toBe(0.5)
    expect(gridStep(0.25, 32)).toBe(0.5)
    expect(gridStep(0.25, 8)).toBe(2)
    expect(gridStep(0.5, 32)).toBe(0.5)
    expect(gridStep(1, 4)).toBe(4)
  })

  it('falls back to 0.25 m for a base that is not a step, rather than looping', () => {
    expect(gridStep(0, 64)).toBe(0.25)
    expect(gridStep(-1, 64)).toBe(0.25)
    expect(gridStep(Number.NaN, 64)).toBe(0.25)
  })

  it("lists the lines in view, every fourth major (Last Light's case: 40 px to a metre from the origin)", () => {
    const viewport = createViewport({ size: { w: 400, h: 400 }, zoom: 40, limits: PLAN_LIMITS })
    const { step, xs, zs } = gridLines(viewport, 1)
    expect(step).toBe(1)
    expect(xs.map((line) => line.m)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(zs.map((line) => line.m)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(xs.filter((line) => line.major).map((line) => line.m)).toEqual([0, 4, 8])
  })

  it('coarsens when zoomed out and lists negative lines when the view holds them', () => {
    const far = gridLines(createViewport({ size: { w: 400, h: 400 }, zoom: 4, limits: PLAN_LIMITS }), 1)
    expect(far.step).toBe(4)
    const near = gridLines(planViewport({ x: 0, z: 0, zoom: 1.25 }, { w: 400, h: 400 }), 1)
    expect(near.xs.map((line) => line.m)).toEqual([-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5])
    expect(near.xs.filter((line) => line.major).map((line) => line.m)).toEqual([-4, 0, 4])
  })

  it('writes the lines of a step that is not a power of two without float noise, one on the edge of the view included', () => {
    // 48 px at 160 px to a metre is 0.3 m wide, and 0.3 / 0.1 is 2.9999999999999996.
    const viewport = createViewport({ size: { w: 48, h: 48 }, zoom: 160, limits: PLAN_LIMITS })
    expect(gridLines(viewport, 0.1).xs.map((line) => line.m)).toEqual([0, 0.1, 0.2, 0.3])
    expect(gridLines(viewport, 0.1).zs.map((line) => line.m)).toEqual([0, 0.1, 0.2, 0.3])
    // And on the other side: -0.3 / 0.1 is -2.9999999999999996, which rounds up past the line.
    const behind = createViewport({
      size: { w: 48, h: 48 },
      zoom: 160,
      pan: { x: 48, y: 0 },
      limits: PLAN_LIMITS,
    })
    expect(gridLines(behind, 0.1).xs.map((line) => line.m)).toEqual([-0.3, -0.2, -0.1, 0])
    expect(gridLines(behind, 0.1).zs.map((line) => line.m)).toEqual([0, 0.1, 0.2, 0.3])
  })

  it('lists the columns by the canvas width and the rows by its height', () => {
    const wide = createViewport({ size: { w: 400, h: 200 }, zoom: 40, limits: PLAN_LIMITS })
    const { xs, zs } = gridLines(wide, 1)
    expect(xs.map((line) => line.m)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(zs.map((line) => line.m)).toEqual([0, 1, 2, 3, 4, 5])
  })
})

describe('snapStep and snapValue', () => {
  it('snaps to 5 cm, 1 cm with shift, and not at all with alt (kept to 0.1 mm)', () => {
    expect(snapStep()).toBe(0.05)
    expect(snapStep({ shiftKey: true })).toBe(0.01)
    expect(snapStep({ altKey: true, shiftKey: true })).toBe(0)
    expect(snapValue(1.4737, 0.05)).toBe(1.45)
    expect(snapValue(1.476, 0.05)).toBe(1.5)
    expect(snapValue(0.3 * 3, 0.05)).toBe(0.9)
    expect(snapValue(1.4737, 0.01)).toBe(1.47)
    expect(snapValue(1.47372, 0)).toBe(1.4737)
    expect(Object.is(snapValue(-0.01, 0.05), 0)).toBe(true)
  })
})

describe('fitInto', () => {
  // A 744 by 420 px area with its top at y = 56, in a canvas 869 px wide and 662 tall: what a top bar of tools and a
  // sheet along the bottom leave of it.
  const canvas = { w: 869, h: 662 }
  const usable = { x: 0, y: 56, w: 744, h: 420 }
  const room = { x: 0, y: 0, w: 10, h: 6 }

  it('fits the room inside the area the sheet and tools leave', () => {
    const viewport = planViewport(fitInto(room, usable, canvas), canvas)
    const topLeft = toScreen(viewport, { x: 0, z: 0 })
    const bottomRight = toScreen(viewport, { x: 10, z: 6 })
    expect(topLeft.x).toBeGreaterThanOrEqual(usable.x)
    expect(topLeft.y).toBeGreaterThanOrEqual(usable.y)
    expect(bottomRight.x).toBeLessThanOrEqual(usable.x + usable.w)
    expect(bottomRight.y).toBeLessThanOrEqual(usable.y + usable.h)
  })

  it('centres the room in the area, not in the canvas', () => {
    const viewport = planViewport(fitInto(room, usable, canvas), canvas)
    const centre = toScreen(viewport, { x: 5, z: 3 })
    expect(centre.x).toBeCloseTo(usable.x + usable.w / 2, 6)
    expect(centre.y).toBeCloseTo(usable.y + usable.h / 2, 6)
  })

  it('is fitPlan when the area is the whole canvas', () => {
    const whole = { x: 0, y: 0, ...canvas }
    expect(fitInto(room, whole, canvas)).toEqual(fitPlan(room, canvas))
  })
})

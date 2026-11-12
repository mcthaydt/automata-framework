import { describe, expect, it } from 'vitest'
import {
  CAMERA_DEFAULTS,
  CAMERA_RANGES,
  cameraView,
  cameraViewSchema,
} from '#src/features/camera/sim/camera-view.schema.ts'

describe('camera-view', () => {
  it('a view that omits everything compiles to the follow camera: 30° down, 16 m back, a 1 m focus, 1/7 s of lag, 0.25 m enter margin, free turning', () => {
    expect(cameraViewSchema.parse({})).toEqual({
      tiltDeg: 30,
      distance: 16,
      focusHeight: 1,
      lag: 1 / 7,
      rotate: true,
      follow: 1,
      enterMargin: 0.25,
    })
    expect(CAMERA_DEFAULTS).toEqual({
      tiltDeg: 30,
      distance: 16,
      focusHeight: 1,
      lag: 1 / 7,
      rotate: true,
      follow: 1,
      enterMargin: 0.25,
    })
  })

  it('keeps what is given: a heading, bounds, a fixed arena', () => {
    const given = {
      yawDeg: 90,
      tiltDeg: 40,
      distance: 8,
      focusHeight: 1.5,
      lag: 0,
      rotate: false,
      follow: 1,
      enterMargin: 0.25,
      bounds: { min: [-4, 0, -4], max: [4, 3, 4] },
    }
    expect(cameraViewSchema.parse(given)).toEqual(given)
  })

  it('keeps a zone’s authored shot: look, x, follow, depthFollow and enterMargin', () => {
    const given = {
      tiltDeg: 30,
      distance: 16.6,
      focusHeight: 1,
      lag: 1 / 7,
      rotate: true,
      look: [0, 1.1, 0.75],
      x: 2.2,
      follow: 0.12,
      depthFollow: { rate: 0.15, about: 2 },
      enterMargin: 0.5,
    }
    expect(cameraViewSchema.parse(given)).toEqual(given)
  })

  it('refuses a fixed shot (follow below 1) that names no look: there is nothing to hold', () => {
    const result = cameraViewSchema.safeParse({ follow: 0.5 })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['look'])
    expect(cameraViewSchema.safeParse({ follow: 0.5, look: [0, 1, 0] }).success).toBe(true)
  })

  it('refuses a follow outside 0 to 1, a negative enter margin and a depthFollow without both fields', () => {
    for (const bad of [
      { follow: -0.1, look: [0, 1, 0] },
      { follow: 1.1 },
      { enterMargin: -0.1 },
      { depthFollow: { rate: 0.1 } },
    ])
      expect(cameraViewSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false)
  })

  it.each([
    ['tiltDeg', 24.9],
    ['tiltDeg', 40.1],
    ['distance', 2.9],
    ['distance', 20.1],
  ] as const)(
    'refuses %s %d, outside its authored range (a zone’s tilt is 25° to 40°, its distance up to 20 m)',
    (field, value) => {
      const result = cameraViewSchema.safeParse({ [field]: value })
      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.path).toEqual([field])
    },
  )

  it('has the ranges of the rules: tilt 25° to 40°, distance 3 m to 20 m (16 to 17 m is a real zone)', () => {
    expect(CAMERA_RANGES).toEqual({
      tiltDeg: { min: 25, max: 40 },
      distance: { min: 3, max: 20 },
      lensMm: { min: 24, max: 200 },
    })
    expect(cameraViewSchema.safeParse({ distance: 16.6 }).success).toBe(true)
  })

  it('accepts the ends of the ranges', () => {
    const { tiltDeg, distance } = CAMERA_RANGES
    for (const view of [
      { tiltDeg: tiltDeg.min, distance: distance.min },
      { tiltDeg: tiltDeg.max, distance: distance.max },
    ])
      expect(cameraViewSchema.safeParse(view).success).toBe(true)
  })

  it('refuses a negative lag or focus height, a non-finite heading and unknown fields', () => {
    for (const bad of [{ lag: -0.1 }, { focusHeight: -1 }, { yawDeg: Number.NaN }, { tilt: 25 }])
      expect(cameraViewSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false)
  })

  it('refuses bounds whose min passes max on any axis', () => {
    const result = cameraViewSchema.safeParse({ bounds: { min: [0, 0, 5], max: [1, 1, 4] } })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['bounds'])
  })

  it('cameraView names a view: its id is the file’s name, the rest the file’s fields with defaults', () => {
    expect(cameraView('hall', { distance: 7 })).toEqual({ id: 'hall', ...CAMERA_DEFAULTS, distance: 7 })
    expect(() => cameraView('hall', { distance: 99 })).toThrow()
  })
  it('keeps a view\u2019s own lens, in millimetres, and has none unless it is given one', () => {
    expect(cameraViewSchema.parse({}).lensMm).toBeUndefined()
    expect(cameraViewSchema.parse({ lensMm: 85 }).lensMm).toBe(85)
    expect(CAMERA_RANGES.lensMm).toEqual({ min: 24, max: 200 })
  })

  it('refuses a lens outside 24 to 200 mm, never clamping it', () => {
    expect(() => cameraViewSchema.parse({ lensMm: 20 })).toThrow()
    expect(() => cameraViewSchema.parse({ lensMm: 250 })).toThrow()
  })
  it('keeps a locked-on view\u2019s focus box, a rectangle on the floor, and refuses one that is turned inside out', () => {
    const given = { focusBounds: { min: [-2, -1], max: [3, 4] } }
    expect(cameraViewSchema.parse(given).focusBounds).toEqual(given.focusBounds)
    expect(cameraViewSchema.parse({}).focusBounds).toBeUndefined()
    expect(() => cameraViewSchema.parse({ focusBounds: { min: [3, 0], max: [2, 4] } })).toThrow()
  })
  it('keeps a view\u2019s lead, in metres, and has none unless it is given one; a negative lead is refused', () => {
    expect(cameraViewSchema.parse({}).lead).toBeUndefined()
    expect(cameraViewSchema.parse({ lead: 1.5 }).lead).toBe(1.5)
    expect(() => cameraViewSchema.parse({ lead: -1 })).toThrow()
  })
})

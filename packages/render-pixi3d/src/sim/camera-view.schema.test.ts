import { describe, expect, it } from 'vitest'
import { CAMERA_DEFAULTS, CAMERA_RANGES, cameraView, cameraViewSchema } from './camera-view.schema.js'

describe('camera-view', () => {
  it('a view that omits everything compiles to the Owner’s 25° and 5 m, a 1 m focus, 0.18 s of lag and free turning (D3-j)', () => {
    expect(cameraViewSchema.parse({})).toEqual({
      tiltDeg: 25,
      distance: 5,
      focusHeight: 1,
      lag: 0.18,
      rotate: true,
    })
    expect(CAMERA_DEFAULTS).toEqual({ tiltDeg: 25, distance: 5, focusHeight: 1, lag: 0.18, rotate: true })
  })

  it('keeps what is given: a heading, bounds, a fixed arena', () => {
    const given = {
      yawDeg: 90,
      tiltDeg: 40,
      distance: 8,
      focusHeight: 1.5,
      lag: 0,
      rotate: false,
      bounds: { min: [-4, 0, -4], max: [4, 3, 4] },
    }
    expect(cameraViewSchema.parse(given)).toEqual(given)
  })

  it.each([
    ['tiltDeg', 14.9],
    ['tiltDeg', 60.1],
    ['distance', 2.9],
    ['distance', 12.1],
  ] as const)('refuses %s %d, outside its authored range (M3R-D11)', (field, value) => {
    const result = cameraViewSchema.safeParse({ [field]: value })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual([field])
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
})

// The angled camera's geometry (M3 spec §4.2): where the eye sits for a focus, a heading, a tilt and a distance;
// the bounds clamp; the lock-on bias; the eases' curve and the shorter arc.
import { describe, expect, it } from 'vitest'
import { clampToBounds, eyeOf, framedFocus, LOCK_SHARE, projectToNdc, shorterArc } from './camera-pose.ts'
import { fovOf, LENS_MM } from './fov.ts'
import { cameraView } from './sim/camera-view.schema.ts'

const FOV = fovOf(LENS_MM)
const ORIGIN = { x: 0, y: 0, z: 0 }

describe('eyeOf', () => {
  it('at the Owner’s view sits 2.11 m above the focus and 4.53 m behind it, 3.1 m above the floor', () => {
    const { tiltDeg, distance, focusHeight } = cameraView('default')
    const focus = { x: 0, y: focusHeight, z: 0 }
    const eye = eyeOf(focus, 0, tiltDeg, distance)
    expect(eye.y - focus.y).toBeCloseTo(2.113, 3)
    // Heading 0 looks toward +z, so behind is −z.
    expect(eye.z).toBeCloseTo(-4.532, 3)
    expect(eye.x).toBeCloseTo(0, 12)
    expect(eye.y).toBeCloseTo(3.11, 2)
  })

  it('swings behind the focus as the heading turns: at 90° (toward +x) the eye is on −x', () => {
    const eye = eyeOf(ORIGIN, 90, 25, 5)
    expect(eye.x).toBeCloseTo(-4.532, 3)
    expect(eye.z).toBeCloseTo(0, 12)
  })
})

describe('clampToBounds', () => {
  it('keeps a point inside the box and leaves it alone without one', () => {
    const bounds = { min: [-1, 0, -2], max: [1, 3, 2] } as const
    expect(clampToBounds({ x: 5, y: -1, z: 0.5 }, bounds)).toEqual({ x: 1, y: 0, z: 0.5 })
    expect(clampToBounds({ x: 5, y: -1, z: 0.5 }, undefined)).toEqual({ x: 5, y: -1, z: 0.5 })
  })
})

describe('the eases', () => {
  it('turns by the shorter arc', () => {
    expect(shorterArc(350, 10)).toBe(20)
    expect(shorterArc(10, 350)).toBe(-20)
    expect(shorterArc(0, 180)).toBe(180)
    expect(shorterArc(90, 90)).toBe(0)
  })
})

describe('framedFocus (lock-on)', () => {
  const view = cameraView('hall')
  const player = { x: 0, y: 0, z: 0 }
  const base = { x: 0, y: view.focusHeight, z: 0 }

  it('moves the focus 35% of the way toward a near lock target', () => {
    expect(LOCK_SHARE).toBe(0.35)
    const focus = framedFocus({ player, lock: { x: 2, y: 0, z: 0 }, view, headingDeg: 0, aspect: 16 / 9 })
    expect(focus.x).toBeCloseTo(0.7, 9)
    expect(focus.y).toBeCloseTo(base.y, 9)
  })

  it('never past the view’s bounds', () => {
    const bounded = cameraView('hall', { bounds: { min: [-0.3, 0, -5], max: [5, 3, 5] } })
    const focus = framedFocus({
      player,
      lock: { x: -2, y: 0, z: 0 },
      view: bounded,
      headingDeg: 0,
      aspect: 16 / 9,
    })
    expect(focus.x).toBe(-0.3)
  })

  it('never so far that the player leaves the middle third of the frame', () => {
    for (const aspect of [4 / 3, 16 / 9, 21 / 9])
      for (const lock of [
        { x: 40, y: 0, z: 0 },
        { x: 0, y: 0, z: -30 },
        { x: -25, y: 10, z: 25 },
      ]) {
        const focus = framedFocus({ player, lock, view, headingDeg: 30, aspect })
        const eye = eyeOf(focus, 30, view.tiltDeg, view.distance)
        const ndc = projectToNdc(base, eye, focus, FOV, aspect)
        expect(Math.abs(ndc.x)).toBeLessThanOrEqual(1 / 3 + 1e-6)
        expect(Math.abs(ndc.y)).toBeLessThanOrEqual(1 / 3 + 1e-6)
        // And it still leans toward the target.
        const leaned = (focus.x - base.x) * lock.x + (focus.z - base.z) * lock.z
        expect(leaned).toBeGreaterThan(0)
      }
  })

  it('never leans so far that the player is behind the eye (review #245, 4)', () => {
    for (const tiltDeg of [15, 25, 40, 60])
      for (const distance of [3, 5, 12]) {
        const steep = cameraView('steep', { tiltDeg, distance })
        const steepBase = { x: 0, y: steep.focusHeight, z: 0 }
        for (const lock of [
          { x: 0, y: -20, z: 47.5 },
          { x: 0, y: -60, z: 10 },
          { x: 3, y: -200, z: 0 },
        ]) {
          const focus = framedFocus({ player, lock, view: steep, headingDeg: 0, aspect: 16 / 9 })
          const eye = eyeOf(focus, 0, tiltDeg, distance)
          const ndc = projectToNdc(steepBase, eye, focus, FOV, 16 / 9)
          expect(ndc.depth, JSON.stringify({ tiltDeg, distance, lock })).toBeGreaterThan(0)
          expect(Math.abs(ndc.x)).toBeLessThanOrEqual(1 / 3 + 1e-6)
          expect(Math.abs(ndc.y)).toBeLessThanOrEqual(1 / 3 + 1e-6)
        }
      }
  })

  it('without a lock is the player’s focus, clamped', () => {
    expect(framedFocus({ player, lock: undefined, view, headingDeg: 0, aspect: 1 })).toEqual(base)
  })
})

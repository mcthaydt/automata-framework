// The Studio stage's camera (EDS.9a; EDS-D13): an orbit about the figure, in the maths the stage and its handles share, so
// what a handle shows and what a drag moves agree without asking the renderer. Pure: no WebGL, no DOM.
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ORBIT,
  dragPlane,
  type Orbit,
  orbit,
  pickRay,
  project,
  rayAtPlane,
  turned,
} from '#src/features/studio/stage/stage-camera.ts'

const SIZE = { w: 800, h: 600 }

describe('project', () => {
  it('puts the orbit’s target at the middle of the picture', () => {
    const at = project(DEFAULT_ORBIT, SIZE, DEFAULT_ORBIT.target)
    expect(at?.x).toBeCloseTo(400, 6)
    expect(at?.y).toBeCloseTo(300, 6)
  })

  it('puts a point to the figure’s left (+x) on the right of the picture when the camera looks from the front (+z)', () => {
    const left = project(DEFAULT_ORBIT, SIZE, [0.3, DEFAULT_ORBIT.target[1], 0])
    expect(left?.x).toBeGreaterThan(400)
    const higher = project(DEFAULT_ORBIT, SIZE, [0, DEFAULT_ORBIT.target[1] + 0.3, 0])
    expect(higher?.y).toBeLessThan(300)
  })

  it('says nothing for a point behind the camera', () => {
    expect(project(DEFAULT_ORBIT, SIZE, [0, 1, DEFAULT_ORBIT.distance * 3])).toBeUndefined()
  })
})

describe('pickRay and rayAtPlane', () => {
  it('shoots from the eye through the pixel, and meets the plane through the target at the target for the middle pixel', () => {
    const ray = pickRay(DEFAULT_ORBIT, SIZE, { x: 400, y: 300 })
    const plane = dragPlane(DEFAULT_ORBIT, DEFAULT_ORBIT.target)
    const hit = rayAtPlane(ray, plane)
    expect(hit?.[0]).toBeCloseTo(DEFAULT_ORBIT.target[0], 6)
    expect(hit?.[1]).toBeCloseTo(DEFAULT_ORBIT.target[1], 6)
    expect(hit?.[2]).toBeCloseTo(DEFAULT_ORBIT.target[2], 6)
  })

  it('inverts project on the plane facing the camera through a point', () => {
    const point: [number, number, number] = [0.25, 1.2, 0.1]
    const pixel = project(DEFAULT_ORBIT, SIZE, point)
    if (pixel === undefined) throw new Error('not in view')
    const hit = rayAtPlane(pickRay(DEFAULT_ORBIT, SIZE, pixel), dragPlane(DEFAULT_ORBIT, point))
    expect(hit?.[0]).toBeCloseTo(point[0], 5)
    expect(hit?.[1]).toBeCloseTo(point[1], 5)
    expect(hit?.[2]).toBeCloseTo(point[2], 5)
  })
})

describe('orbit and turned', () => {
  it('turns by the drag, and keeps the pitch inside what looks at the figure', () => {
    const next = orbit(DEFAULT_ORBIT, { dx: 100, dy: 4000 })
    expect(next.yaw).not.toBe(DEFAULT_ORBIT.yaw)
    expect(next.pitch).toBeLessThanOrEqual(1.4)
    expect(orbit(DEFAULT_ORBIT, { dx: 0, dy: -4000 }).pitch).toBeGreaterThanOrEqual(-0.4)
  })

  it('turns the figure by a sideways drag as a facing, in turns of a full circle for a drag across the stage', () => {
    const o: Orbit = DEFAULT_ORBIT
    expect(turned(0, 400, 800)).toBeCloseTo(Math.PI, 6)
    expect(turned(Math.PI, -400, 800)).toBeCloseTo(0, 6)
    expect(o.distance).toBeGreaterThan(0)
  })
})

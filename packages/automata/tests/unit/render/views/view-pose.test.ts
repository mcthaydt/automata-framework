import { describe, expect, it } from 'vitest'
import { interpolatePose, lerp, lerpAngle, poseComponent } from '#src/features/render/views/view-pose.ts'

describe('lerp', () => {
  it('blends linearly from a to b', () => {
    expect(lerp(2, 10, 0)).toBe(2)
    expect(lerp(2, 10, 0.5)).toBe(6)
    expect(lerp(2, 10, 1)).toBe(10)
  })

  it('lands exactly on b at t = 1, where a + (b - a) would round', () => {
    expect(lerp(0.7, 0.1, 1)).toBe(0.1)
  })
})

describe('lerpAngle', () => {
  it('takes the short way across ±π instead of sweeping through 0', () => {
    const halfway = lerpAngle(Math.PI - 0.1, -Math.PI + 0.1, 0.5)
    expect(Math.abs(Math.abs(halfway) - Math.PI)).toBeLessThan(1e-9)
  })

  it('goes backwards through 0 when that arc is shorter', () => {
    const quarter = lerpAngle(0.1, 2 * Math.PI - 0.1, 0.25)
    expect(quarter).toBeCloseTo(0.05, 9)
  })

  it('ends exactly on the current angle at t = 1 and the previous at t = 0', () => {
    expect(lerpAngle(0.5, 1.5, 0)).toBe(0.5)
    expect(lerpAngle(0.5, 1.5, 1)).toBe(1.5)
  })

  it('blends ordinary angles linearly', () => {
    expect(lerpAngle(0, 1, 0.5)).toBeCloseTo(0.5, 12)
  })
})

describe('interpolatePose', () => {
  it('shows the current pose when there is no previous tick', () => {
    expect(interpolatePose({ x: 4, y: 5, angle: 1 }, undefined, 0.25)).toEqual({ x: 4, y: 5, angle: 1 })
  })

  it('blends x, y and angle by alpha', () => {
    const pose = interpolatePose({ x: 8, y: 4, angle: 1 }, { x: 0, y: 0, angle: 0 }, 0.25)
    expect(pose.x).toBe(2)
    expect(pose.y).toBe(1)
    expect(pose.angle).toBeCloseTo(0.25, 12)
  })

  it('treats a missing angle as 0 and non-numeric x/y as 0', () => {
    expect(interpolatePose({ x: 3, y: 'no' }, undefined, 1)).toEqual({ x: 3, y: 0, angle: 0 })
  })
})

describe('poseComponent', () => {
  const components = {
    a: { hp: 3 },
    b: { x: 1, y: 2 },
    c: { x: 5, y: 6 },
  }

  it('picks the named component', () => {
    expect(poseComponent(components, 'c')).toBe(components.c)
  })

  it('without a name, picks the first component with numeric x and y', () => {
    expect(poseComponent(components)).toBe(components.b)
  })

  it('returns undefined when nothing matches', () => {
    expect(poseComponent({ a: { hp: 1 } })).toBeUndefined()
    expect(poseComponent(components, 'missing')).toBeUndefined()
  })
})

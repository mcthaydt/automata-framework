import { describe, expect, it } from 'vitest'
import { groundOf } from '#src/features/look/passes/reflect-effect.ts'

/** A rotation about x by `angle` (radians). */
const about = (axis: 'x' | 'y', angle: number) => ({
  x: axis === 'x' ? Math.sin(angle / 2) : 0,
  y: axis === 'y' ? Math.sin(angle / 2) : 0,
  z: 0,
  w: Math.cos(angle / 2),
})

describe('the ground as a camera sees it', () => {
  it('has the world’s up straight up in the view of a level camera, at the camera’s height', () => {
    const ground = groundOf(1.5, { x: 0, y: 0, z: 0, w: 1 })
    expect(ground.height).toBe(1.5)
    expect(ground.up[0]).toBeCloseTo(0, 6)
    expect(ground.up[1]).toBeCloseTo(1, 6)
    expect(ground.up[2]).toBeCloseTo(0, 6)
  })

  it('leans toward the camera’s back as it tips down, and stays unit length', () => {
    // Looking along -z, tipped down by 30°: a rotation about x of -30°.
    const ground = groundOf(2, about('x', (-30 * Math.PI) / 180))
    expect(ground.up[1]).toBeCloseTo(Math.cos((30 * Math.PI) / 180), 6)
    expect(ground.up[2]).toBeCloseTo(Math.sin((30 * Math.PI) / 180), 6)
    expect(Math.hypot(...ground.up)).toBeCloseTo(1, 6)
  })

  it('is the same however the camera turns about the vertical', () => {
    const turned = groundOf(1, about('y', 1.1))
    expect(turned.up[1]).toBeCloseTo(1, 6)
    expect(turned.up[0]).toBeCloseTo(0, 6)
  })
})

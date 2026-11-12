import { describe, expect, it } from 'vitest'
import { adaMoving, adaYaw, kitYaw, stepped, walkedYaw } from '#src/features/figures/figure-view.ts'

// What the sim says a character is doing, as the painted figure shows it: the way she faces, and whether she walks (her legs move)
// or stands.

const at = (x: number, z: number) => ({ 'sectors.in-sector': { x, z } })

describe('which way a figure faces', () => {
  it('Ada faces the heading of her last step', () => {
    expect(adaYaw({ ...at(0, 0), ada: { yaw: 1.5 } }, undefined, 0)).toBe(1.5)
  })

  it('a figure with no heading of its own faces the way it last moved, and keeps it standing still', () => {
    expect(walkedYaw(at(1, 0), at(0, 0), 0)).toBeCloseTo(Math.PI / 2)
    expect(walkedYaw(at(1, 0), at(1, 0), 2)).toBe(2)
  })
})

/** Where a painted figure faces on the plan for the yaw it is given: the kit's rule, an entity's yaw 0 faces -z (north) and turns about up. */
const facingOf = (yaw: number) => ({ x: -Math.sin(yaw), z: -Math.cos(yaw) })

describe('the painted figure faces where the game says', () => {
  // The game's heading is the sim's: 0 faces +z (south, toward the play camera), a quarter turn faces east (+x), and a step is
  // atan2(dx, dz). The kit's figure has its own zero: half a turn from that.
  it('walking north draws a figure with its back to the camera, as the old game did', () => {
    const north = facingOf(kitYaw(walkedYaw(at(0, -1), at(0, 0), 0)))
    expect(north.x).toBeCloseTo(0)
    expect(north.z).toBeCloseTo(-1)
  })

  it('draws every heading toward where it points', () => {
    for (const [dx, dz] of [
      [1, 0],
      [0, 1],
      [-1, 0],
      [1, 1],
      [-1, 2],
    ]) {
      const norm = Math.hypot(dx as number, dz as number)
      const drawn = facingOf(kitYaw(walkedYaw(at(dx as number, dz as number), at(0, 0), 0)))
      expect(drawn.x).toBeCloseTo((dx as number) / norm)
      expect(drawn.z).toBeCloseTo((dz as number) / norm)
    }
  })
})

describe('whether a figure walks', () => {
  it('Ada walks while her component says so', () => {
    expect(adaMoving({ ...at(0, 0), ada: { walking: true } }, undefined)).toBe(true)
    expect(adaMoving({ ...at(0, 0), ada: { walking: false } }, undefined)).toBe(false)
  })

  it('the figure walks when its place changed since the frame before, and stands otherwise', () => {
    expect(stepped(at(1, 0), at(0, 0))).toBe(true)
    expect(stepped(at(1, 0), at(1, 0))).toBe(false)
    expect(stepped(at(1, 0), undefined)).toBe(false)
  })
})

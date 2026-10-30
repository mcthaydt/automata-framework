// D3-i: the sim's mapper turns "stick up" into the direction away from the camera at every heading, with `sin` and
// `cos` from `@mcthaydt/automata-sim/math` (the module calls no `Math` trig; `pnpm boundaries` checks it), within one
// Q16.16 unit of the exact value. This test may use `Math`: it is the exact value.
import { describe, expect, it } from 'vitest'
import { STICK_SWEEP_HASH, stickSweepHash } from '../testing/stick-sweep.js'
import { TURN_UNITS } from './heading.js'
import { mapStick, Q16, STICK_MAX } from './stick-mapper.js'

const radians = (heading: number) => (heading / TURN_UNITS) * 2 * Math.PI
const HEADINGS = [
  ...Array.from({ length: 64 }, (_, k) => k * 1_024),
  1,
  4_095,
  16_383,
  16_384,
  16_385,
  32_768,
  49_152,
  65_535,
]

function expectWithinOneUnit(actual: { x: number; z: number }, exact: { x: number; z: number }) {
  expect(Number.isInteger(actual.x) && Number.isInteger(actual.z)).toBe(true)
  expect(Math.abs(actual.x - exact.x * Q16)).toBeLessThanOrEqual(1)
  expect(Math.abs(actual.z - exact.z * Q16)).toBeLessThanOrEqual(1)
}

describe('mapStick', () => {
  it('is Q16.16 over a stick of ±127 a side', () => {
    expect(Q16).toBe(65_536)
    expect(STICK_MAX).toBe(127)
  })

  it('maps stick up (y −127) to the camera’s forward, (sin h, cos h), away from the camera at every heading', () => {
    for (const heading of HEADINGS) {
      const h = radians(heading)
      expectWithinOneUnit(mapStick({ x: 0, y: -127 }, heading), { x: Math.sin(h), z: Math.cos(h) })
    }
    expect(mapStick({ x: 0, y: -127 }, 0)).toEqual({ x: 0, z: Q16 })
    expect(mapStick({ x: 0, y: -127 }, TURN_UNITS / 4)).toEqual({ x: Q16, z: 0 })
  })

  it('maps stick right to the camera’s right, (−cos h, sin h), and down to the camera', () => {
    for (const heading of HEADINGS) {
      const h = radians(heading)
      expectWithinOneUnit(mapStick({ x: 127, y: 0 }, heading), { x: -Math.cos(h), z: Math.sin(h) })
      expectWithinOneUnit(mapStick({ x: 0, y: 127 }, heading), { x: -Math.sin(h), z: -Math.cos(h) })
    }
  })

  it('keeps the stick’s length: a half push is a half step, a diagonal is the rotated vector', () => {
    for (const heading of HEADINGS) {
      const h = radians(heading)
      const [sx, sy] = [64, -90]
      const forward = -sy / 127
      const right = sx / 127
      expectWithinOneUnit(mapStick({ x: sx, y: sy }, heading), {
        x: Math.sin(h) * forward - Math.cos(h) * right,
        z: Math.cos(h) * forward + Math.sin(h) * right,
      })
    }
  })

  it('gives (0, 0) for a centred stick, never −0', () => {
    for (const heading of HEADINGS) {
      const { x, z } = mapStick({ x: 0, y: 0 }, heading)
      expect(Object.is(x, 0) && Object.is(z, 0)).toBe(true)
    }
  })

  it('gives the golden sweep in Node (the parity test checks the browsers)', () => {
    expect(stickSweepHash()).toBe(STICK_SWEEP_HASH)
  })
})

// Second-order dynamics (M6.1a step 2): a value that follows a target the way a spring does, from the arcade source's cases.
import { describe, expect, it } from 'vitest'
import { SecondOrder, snapTo } from './second-order'

function run(spring: SecondOrder, target: number, seconds: number, fps: number): number[] {
  const out: number[] = []
  const frames = Math.round(seconds * fps)
  for (let i = 0; i < frames; i += 1) out.push(spring.update(1 / fps, target))
  return out
}

describe('SecondOrder', () => {
  it('settles to its target', () => {
    const spring = new SecondOrder({ f: 3, zeta: 0.5, r: 0 })
    const trace = run(spring, 1, 3, 60)
    expect(trace.at(-1)).toBeCloseTo(1, 3)
    expect(spring.settled).toBe(true)
  })
  it('overshoots below zeta 1 and not at or above it', () => {
    expect(Math.max(...run(new SecondOrder({ f: 3, zeta: 0.3, r: 0 }), 1, 2, 60))).toBeGreaterThan(1.05)
    expect(Math.max(...run(new SecondOrder({ f: 3, zeta: 1, r: 0 }), 1, 2, 60))).toBeLessThanOrEqual(1.0001)
  })
  it('winds up first with a negative r', () => {
    expect(Math.min(...run(new SecondOrder({ f: 3, zeta: 0.7, r: -1 }), 1, 1, 60))).toBeLessThan(0)
  })
  it('springs back from a knock, through zero', () => {
    const spring = new SecondOrder({ f: 4, zeta: 0.35, r: 0 })
    spring.knock(0.25)
    expect(spring.value).toBeCloseTo(0.25, 6)
    const trace = run(spring, 0, 1, 60)
    expect(Math.min(...trace)).toBeLessThan(0)
    expect(trace.at(-1)).toBeCloseTo(0, 2)
  })
  it('matches across 30, 60 and 144 fps', () => {
    const at = (fps: number) => run(new SecondOrder({ f: 2, zeta: 0.4, r: 0 }), 1, 0.5, fps).at(-1) as number
    expect(at(30)).toBeCloseTo(at(144), 1)
    expect(at(60)).toBeCloseTo(at(144), 2)
  })
  it('never diverges on a 250 ms frame', () => {
    const spring = new SecondOrder({ f: 8, zeta: 0.2, r: 2 })
    for (let i = 0; i < 20; i += 1) spring.update(0.25, i % 2 === 0 ? 1 : -1)
    expect(Math.abs(spring.value)).toBeLessThan(10)
  })
  it('jumps on set, with no velocity', () => {
    const spring = new SecondOrder({ f: 3, zeta: 0.5, r: 0 })
    spring.update(1 / 60, 1)
    spring.set(0)
    expect(spring.value).toBe(0)
    expect(spring.velocity).toBe(0)
    expect(spring.update(1 / 60, 0)).toBe(0)
  })
  it('lifts to a knock’s height without stacking knocks, and springs back to the same target', () => {
    const spring = new SecondOrder({ f: 4, zeta: 0.35, r: 0 })
    spring.lift(0.5)
    spring.lift(0.5)
    expect(spring.value).toBe(0.5)
    spring.update(1 / 60, 0)
    const lower = spring.value
    spring.lift(0.1) // below where it is: nothing
    expect(spring.value).toBe(lower)
    expect(run(spring, 0, 2, 60).at(-1)).toBeCloseTo(0, 2)
  })
  it('snaps a drawn value to its step', () => {
    expect(snapTo(1.04, 1 / 32)).toBeCloseTo(33 / 32, 9)
    expect(snapTo(-2.6, 1)).toBe(-3)
    expect(Object.is(snapTo(-0.001, 1), 0)).toBe(true)
  })
})

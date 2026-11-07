import { describe, expect, it } from 'vitest'
import { fakeClock } from '#src/testing/fake-clock.ts'

describe('fakeClock', () => {
  it('starts at zero and only moves when told', () => {
    const clock = fakeClock()
    expect(clock.now()).toBe(0)
    clock.advance(250)
    expect(clock.now()).toBe(250)
  })

  it('fires due timeouts in time order, ties in the order they were set', () => {
    const clock = fakeClock()
    const fired: string[] = []
    clock.setTimeout(() => fired.push('late'), 30)
    clock.setTimeout(() => fired.push('early-a'), 10)
    clock.setTimeout(() => fired.push('early-b'), 10)
    clock.advance(9)
    expect(fired).toEqual([])
    clock.advance(21)
    expect(fired).toEqual(['early-a', 'early-b', 'late'])
  })

  it('shows the time of the timeout while it runs', () => {
    const clock = fakeClock()
    const seen: number[] = []
    clock.setTimeout(() => seen.push(clock.now()), 10)
    clock.setTimeout(() => seen.push(clock.now()), 40)
    clock.advance(100)
    expect(seen).toEqual([10, 40])
    expect(clock.now()).toBe(100)
  })

  it('fires a timeout that a firing timeout set, when it falls inside the same advance', () => {
    const clock = fakeClock()
    const fired: string[] = []
    const outerDelay = 10
    clock.setTimeout(() => {
      fired.push('outer')
      clock.setTimeout(() => fired.push('inner'), 5)
    }, outerDelay)
    clock.advance(20)
    expect(fired).toEqual(['outer', 'inner'])
  })

  it('does not fire a cleared timeout', () => {
    const clock = fakeClock()
    let fired = false
    const delay = 10
    const handle = clock.setTimeout(() => {
      fired = true
    }, delay)
    clock.clearTimeout(handle)
    clock.advance(100)
    expect(fired).toBe(false)
    expect(clock.pending()).toBe(0)
  })

  it('counts the timeouts still waiting', () => {
    const clock = fakeClock()
    clock.setTimeout(() => {}, 10)
    clock.setTimeout(() => {}, 20)
    expect(clock.pending()).toBe(2)
    clock.advance(10)
    expect(clock.pending()).toBe(1)
  })
})

import { describe, expect, it } from 'vitest'
import { createLoopGuard, LOOP_GUARD_SAMPLE, LoopGuardError } from '#src/playground/loop-guard.ts'

function fixture(limitMs = 1000) {
  const clock = { ms: 0, reads: 0 }
  const ends: (() => void)[] = []
  const guard = createLoopGuard({
    now: () => {
      clock.reads += 1
      return clock.ms
    },
    onStretch: (end) => ends.push(end),
    limitMs,
  })
  const spin = (calls: number, line = 7) => {
    for (let call = 0; call < calls; call += 1) guard(line)
  }
  return { clock, ends, guard, spin }
}

describe('the loop guard', () => {
  it('reads the clock once per sample of calls, and starts one stretch', () => {
    const { clock, ends, spin } = fixture()
    spin(LOOP_GUARD_SAMPLE - 1)
    expect(clock.reads).toBe(0)
    spin(1)
    expect(clock.reads).toBe(1)
    spin(LOOP_GUARD_SAMPLE * 3)
    expect(clock.reads).toBe(4)
    expect(ends).toHaveLength(1)
  })

  it('lets loops run up to the limit within one stretch', () => {
    const { clock, spin } = fixture()
    spin(LOOP_GUARD_SAMPLE)
    clock.ms = 1000
    expect(() => spin(LOOP_GUARD_SAMPLE)).not.toThrow()
  })

  it('stops a stretch that ran loops past the limit, naming the line', () => {
    const { clock, spin } = fixture()
    spin(LOOP_GUARD_SAMPLE)
    clock.ms = 1001
    let thrown: unknown
    try {
      spin(LOOP_GUARD_SAMPLE, 21)
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(LoopGuardError)
    expect((thrown as LoopGuardError).line).toBe(21)
  })

  it('starts over when the stretch ends, so long-running but yielding work is never stopped', () => {
    const { clock, ends, spin } = fixture()
    for (let frame = 0; frame < 10; frame += 1) {
      spin(LOOP_GUARD_SAMPLE)
      clock.ms += 600
      ends.shift()?.()
    }
    expect(() => spin(LOOP_GUARD_SAMPLE)).not.toThrow()
    expect(ends).toHaveLength(1)
  })
})

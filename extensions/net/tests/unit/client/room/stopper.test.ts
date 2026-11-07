import { fakeClock } from '@automata/framework/testing'
import { describe, expect, it } from 'vitest'
import { createStopper } from '#src/features/client/room/stopper.ts'

describe('a stopper', () => {
  it('calls back when the time is up, once', () => {
    const clock = fakeClock()
    const stopper = createStopper(clock)
    let calls = 0
    stopper.after(100, () => calls++)
    clock.advance(99)
    expect(calls).toBe(0)
    clock.advance(1)
    clock.advance(1000)
    expect(calls).toBe(1)
  })

  it('does not call back after the caller cancels', () => {
    const clock = fakeClock()
    const stopper = createStopper(clock)
    let calls = 0
    const cancel = stopper.after(100, () => calls++)
    cancel()
    clock.advance(1000)
    expect(calls).toBe(0)
    expect(clock.pending()).toBe(0)
  })

  it('calls back at once for everything waiting when it stops, and leaves no timer', () => {
    const clock = fakeClock()
    const stopper = createStopper(clock)
    const called: string[] = []
    stopper.after(100, () => called.push('a'))
    stopper.after(5000, () => called.push('b'))
    stopper.stop()
    expect(called).toEqual(['a', 'b'])
    expect(stopper.stopped).toBe(true)
    expect(clock.pending()).toBe(0)
  })

  it('answers at once once it has stopped', () => {
    const stopper = createStopper(fakeClock())
    stopper.stop()
    let calls = 0
    stopper.after(100, () => calls++)
    expect(calls).toBe(1)
  })

  it('sleeps for the time given, or until it stops', async () => {
    const clock = fakeClock()
    const stopper = createStopper(clock)
    const done: string[] = []
    void stopper.sleep(100).then(() => done.push('timer'))
    clock.advance(100)
    await Promise.resolve()
    expect(done).toEqual(['timer'])
    void stopper.sleep(10_000).then(() => done.push('stopped'))
    stopper.stop()
    await Promise.resolve()
    expect(done).toEqual(['timer', 'stopped'])
  })
})

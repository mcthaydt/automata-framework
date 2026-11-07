import { describe, expect, it, vi } from 'vitest'
import { LoadStalled } from '#src/shared/runtime/boot-error.ts'
import { createLoadMeter, SLOW_MS, STALL_MS } from '#src/shared/runtime/load-meter.ts'
import { fakeClock } from '#src/testing/fake-clock.ts'
import { settle } from '#src/testing/settle.ts'

/** A wait that never ends on its own, and says when the meter aborted it. */
function hangingWait(): { readonly wait: (signal: AbortSignal) => Promise<never>; aborted(): boolean } {
  let aborted = false
  return {
    wait: (signal) =>
      new Promise<never>((_, reject) => {
        signal.addEventListener('abort', () => {
          aborted = true
          reject(new Error('aborted'))
        })
      }),
    aborted: () => aborted,
  }
}

/** Follows a promise so a test can ask whether it has settled yet, and how. */
function watch<A>(promise: Promise<A>): {
  readonly state: () => 'pending' | 'resolved' | 'rejected'
  error: () => unknown
} {
  let state: 'pending' | 'resolved' | 'rejected' = 'pending'
  let error: unknown
  promise.then(
    () => {
      state = 'resolved'
    },
    (reason: unknown) => {
      state = 'rejected'
      error = reason
    },
  )
  return { state: () => state, error: () => error }
}

describe('LoadMeter', () => {
  it('defines STALL_MS as 30000 and SLOW_MS as 8000', () => {
    expect(STALL_MS).toBe(30_000)
    expect(SLOW_MS).toBe(8_000)
  })

  it('fails with LoadStalled at 30000ms (not at 29999ms) and aborts the wait', async () => {
    const clock = fakeClock()
    const meter = createLoadMeter(clock)
    const hang = hangingWait()
    const guarded = watch(meter.guard(hang.wait, { url: 'test://file', bytesSoFar: () => 1024 }))

    clock.advance(29_999)
    await settle()
    expect(guarded.state()).toBe('pending')
    expect(hang.aborted()).toBe(false)

    clock.advance(1)
    await settle()
    expect(guarded.state()).toBe('rejected')
    const error = guarded.error() as LoadStalled
    expect(error).toBeInstanceOf(LoadStalled)
    expect(error._tag).toBe('LoadStalled')
    expect(error.url).toBe('test://file')
    expect(error.bytesSoFar).toBe(1024)
    expect(error.stalledMs).toBe(30_000)
    expect(hang.aborted()).toBe(true)
  })

  it('never fails if progress() is reported every 10s for 300s', async () => {
    const clock = fakeClock()
    const meter = createLoadMeter(clock)
    const controller = new AbortController()
    const guarded = watch(meter.guard(hangingWait().wait, { url: 'test://steady' }, controller.signal))

    for (let i = 0; i < 30; i++) {
      clock.advance(10_000)
      meter.progress()
    }
    await settle()
    expect(guarded.state()).toBe('pending')
    controller.abort()
  })

  it('counts silence from the last report, not from the start', async () => {
    const clock = fakeClock()
    const meter = createLoadMeter(clock)
    const guarded = watch(meter.guard(hangingWait().wait, { url: 'test://reset' }))

    clock.advance(20_000)
    meter.progress()
    clock.advance(20_000)
    await settle()
    expect(guarded.state()).toBe('pending')

    clock.advance(10_000)
    await settle()
    expect(guarded.state()).toBe('rejected')
  })

  it('passes an error from the wait through unchanged and leaves no timer behind', async () => {
    const clock = fakeClock()
    const meter = createLoadMeter(clock)
    class CustomError extends Error {}

    await expect(
      meter.guard(() => Promise.reject(new CustomError()), { url: 'test://err' }),
    ).rejects.toBeInstanceOf(CustomError)
    expect(clock.pending()).toBe(0)
  })

  it('finishing counts as progress and leaves no timer behind', async () => {
    const clock = fakeClock()
    const meter = createLoadMeter(clock)

    await expect(meter.guard(async () => 'ok', { url: 'test://quick' })).resolves.toBe('ok')
    expect(clock.pending()).toBe(0)
  })

  it('does not inherit an idle stretch before a wait begins', async () => {
    const clock = fakeClock()
    const meter = createLoadMeter(clock)
    clock.advance(100_000)

    const guarded = watch(meter.guard(hangingWait().wait, { url: 'test://after-idle' }))
    clock.advance(29_999)
    await settle()
    expect(guarded.state()).toBe('pending')

    clock.advance(1)
    await settle()
    expect(guarded.state()).toBe('rejected')
  })

  it('does not put off the first wait stall when a second wait starts later', async () => {
    const clock = fakeClock()
    const meter = createLoadMeter(clock)
    const first = watch(meter.guard(hangingWait().wait, { url: 'test://first' }))

    clock.advance(20_000)
    const controller = new AbortController()
    meter.guard(hangingWait().wait, { url: 'test://second' }, controller.signal).catch(() => undefined)
    clock.advance(10_000)
    await settle()

    // The first wait has had 30 s of silence since it started; the second one starting must not delay it.
    expect(first.state()).toBe('rejected')
    controller.abort()
  })

  it('runs the slow callback at 8000ms while the wait is pending', async () => {
    const clock = fakeClock()
    const meter = createLoadMeter(clock)
    const onSlow = vi.fn()
    const controller = new AbortController()
    meter.guard(hangingWait().wait, { url: 'test://slow', onSlow }, controller.signal).catch(() => undefined)

    clock.advance(7_999)
    expect(onSlow).not.toHaveBeenCalled()
    clock.advance(1)
    expect(onSlow).toHaveBeenCalledTimes(1)
    controller.abort()
  })

  it('does not run the slow callback for a wait that ended first', async () => {
    const clock = fakeClock()
    const meter = createLoadMeter(clock)
    const onSlow = vi.fn()

    await expect(meter.guard(async () => 'done', { url: 'test://fast', onSlow })).resolves.toBe('done')
    clock.advance(10_000)
    expect(onSlow).not.toHaveBeenCalled()
  })

  it('a caller that aborts stops the wait and its timers', async () => {
    const clock = fakeClock()
    const meter = createLoadMeter(clock)
    const hang = hangingWait()
    const controller = new AbortController()
    const guarded = watch(
      meter.guard(hang.wait, { url: 'test://cancel', onSlow: vi.fn() }, controller.signal),
    )

    controller.abort()
    await settle()
    expect(hang.aborted()).toBe(true)
    expect(guarded.state()).toBe('rejected')
    expect(clock.pending()).toBe(0)
  })
})

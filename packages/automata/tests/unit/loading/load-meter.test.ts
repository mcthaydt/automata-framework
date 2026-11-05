import { Chunk, Duration, Effect, Fiber, TestClock, TestContext, type TestServices } from 'effect'
import { describe, expect, it, vi } from 'vitest'
import { makeLoadMeter, SLOW_MS, STALL_MS } from '#src/features/loading/load-meter.ts'
import type { LoadStalled } from '#src/shared/runtime/boot-error.ts'

const runTest = <A, E>(effect: Effect.Effect<A, E, TestServices.TestServices>): Promise<A> =>
  Effect.runPromise(Effect.provide(effect, TestContext.TestContext) as Effect.Effect<A, E, never>)

describe('LoadMeter', () => {
  it('defines STALL_MS as 30000 and SLOW_MS as 8000', () => {
    expect(STALL_MS).toBe(30_000)
    expect(SLOW_MS).toBe(8_000)
  })

  it('fails with LoadStalled at 30000ms (not at 29999ms) and aborts the wait', async () => {
    await Effect.gen(function* () {
      const meter = yield* makeLoadMeter
      let aborted = false

      const slowFetch = Effect.tryPromise({
        try: (signal) =>
          new Promise<never>((_, reject) => {
            signal.addEventListener('abort', () => {
              aborted = true
              reject(new Error('aborted'))
            })
          }),
        catch: (e) => e,
      })

      const fiber = yield* Effect.fork(
        meter.guard(slowFetch, {
          url: 'test://file',
          bytesSoFar: () => 1024,
        }),
      )

      yield* TestClock.adjust(Duration.millis(29_999))
      let poll = yield* Fiber.poll(fiber)
      expect(poll._tag).toBe('None')
      expect(aborted).toBe(false)

      yield* TestClock.adjust(Duration.millis(1))
      poll = yield* Fiber.poll(fiber)
      expect(poll._tag).toBe('Some')
      if (poll._tag === 'Some' && poll.value._tag === 'Failure') {
        const cause = poll.value.cause
        if (cause._tag === 'Fail') {
          const err = cause.error as LoadStalled
          expect(err._tag).toBe('LoadStalled')
          expect(err.url).toBe('test://file')
          expect(err.bytesSoFar).toBe(1024)
          expect(err.stalledMs).toBe(30_000)
        }
      }
      expect(aborted).toBe(true)
    }).pipe(runTest)
  })

  it('never fails if progress() is reported every 10s for 300s', async () => {
    await Effect.gen(function* () {
      const meter = yield* makeLoadMeter
      const neverEnd = Effect.never

      const fiber = yield* Effect.fork(meter.guard(neverEnd, { url: 'test://steady' }))

      for (let i = 0; i < 30; i++) {
        yield* TestClock.adjust(Duration.seconds(10))
        meter.progress()
      }

      const poll = yield* Fiber.poll(fiber)
      expect(poll._tag).toBe('None')
      yield* Fiber.interrupt(fiber)
    }).pipe(runTest)
  })

  it('counts silence from the last report, not from the start', async () => {
    await Effect.gen(function* () {
      const meter = yield* makeLoadMeter
      const neverEnd = Effect.never

      const fiber = yield* Effect.fork(meter.guard(neverEnd, { url: 'test://reset' }))

      yield* TestClock.adjust(Duration.millis(20_000))
      meter.progress()

      yield* TestClock.adjust(Duration.millis(20_000))
      let poll = yield* Fiber.poll(fiber)
      expect(poll._tag).toBe('None')

      yield* TestClock.adjust(Duration.millis(10_000))
      poll = yield* Fiber.poll(fiber)
      expect(poll._tag).toBe('Some')
      if (poll._tag === 'Some') {
        expect(poll.value._tag).toBe('Failure')
      }
    }).pipe(runTest)
  })

  it('passes error from the wait through unchanged and leaves no sleep on TestClock', async () => {
    await Effect.gen(function* () {
      const meter = yield* makeLoadMeter
      class CustomError {
        readonly _tag = 'CustomError'
      }

      const failingWait = Effect.fail(new CustomError())
      const result = yield* Effect.flip(meter.guard(failingWait, { url: 'test://err' }))
      expect(result).toBeInstanceOf(CustomError)

      // TestClock should advance freely with no uncompleted sleeps
      yield* TestClock.adjust(Duration.seconds(30))
      const sleeps = yield* TestClock.sleeps()
      expect(Chunk.size(sleeps)).toBe(0)
    }).pipe(runTest)
  })

  it('finishing counts as progress and leaves no sleep behind', async () => {
    await Effect.gen(function* () {
      const meter = yield* makeLoadMeter
      const quick = Effect.succeed('ok')

      const result = yield* meter.guard(quick, { url: 'test://quick' })
      expect(result).toBe('ok')

      yield* TestClock.adjust(Duration.seconds(30))
      const sleeps = yield* TestClock.sleeps()
      expect(Chunk.size(sleeps)).toBe(0)
    }).pipe(runTest)
  })

  it('does not inherit an idle stretch before a wait begins', async () => {
    await Effect.gen(function* () {
      const meter = yield* makeLoadMeter
      yield* TestClock.adjust(Duration.seconds(100))

      const fiber = yield* Effect.fork(meter.guard(Effect.never, { url: 'test://after-idle' }))

      yield* TestClock.adjust(Duration.millis(29_999))
      let poll = yield* Fiber.poll(fiber)
      expect(poll._tag).toBe('None')

      yield* TestClock.adjust(Duration.millis(1))
      poll = yield* Fiber.poll(fiber)
      expect(poll._tag).toBe('Some')
    }).pipe(runTest)
  })

  it('does not put off the first wait stall when a second wait starts later', async () => {
    await Effect.gen(function* () {
      const meter = yield* makeLoadMeter

      const fiber1 = yield* Effect.fork(meter.guard(Effect.never, { url: 'test://first' }))

      yield* TestClock.adjust(Duration.millis(20_000))

      const fiber2 = yield* Effect.fork(meter.guard(Effect.never, { url: 'test://second' }))

      yield* TestClock.adjust(Duration.millis(10_000))

      // fiber1 has experienced 30s of silence since it started (and starting fiber2 shouldn't delay fiber1's timeout)
      const poll1 = yield* Fiber.poll(fiber1)
      expect(poll1._tag).toBe('Some')

      yield* Fiber.interrupt(fiber2)
    }).pipe(runTest)
  })

  it('runs the slow callback at 8000ms while the wait is pending', async () => {
    await Effect.gen(function* () {
      const meter = yield* makeLoadMeter
      const onSlow = vi.fn()

      const fiber = yield* Effect.fork(meter.guard(Effect.never, { url: 'test://slow', onSlow }))

      yield* TestClock.adjust(Duration.millis(7_999))
      expect(onSlow).not.toHaveBeenCalled()

      yield* TestClock.adjust(Duration.millis(1))
      expect(onSlow).toHaveBeenCalledTimes(1)

      yield* Fiber.interrupt(fiber)
    }).pipe(runTest)
  })

  it('does not run the slow callback for a wait that ended first', async () => {
    await Effect.gen(function* () {
      const meter = yield* makeLoadMeter
      const onSlow = vi.fn()

      const result = yield* meter.guard(Effect.succeed('done'), {
        url: 'test://fast',
        onSlow,
      })
      expect(result).toBe('done')

      yield* TestClock.adjust(Duration.millis(10_000))
      expect(onSlow).not.toHaveBeenCalled()
    }).pipe(runTest)
  })
})

import { EventEmitter } from 'node:events'
import { Effect, Exit, Fiber, Scope, TestClock, TestContext } from 'effect'
import { describe, expect, it } from 'vitest'
import { DRAIN_MAX_MS, drainOnSigterm, drainRooms } from '#src/features/operations/drain.ts'

// How a server leaves without dropping a game: wait for the
// rooms to finish, capped, and drain once on the first SIGTERM. TestClock moves only when told, so the cap is exact.

const run = <A, E>(effect: Effect.Effect<A, E>): Promise<A> =>
  Effect.runPromise(effect.pipe(Effect.provide(TestContext.TestContext)))

/** A live-room count that reads the next value each time it is asked. */
const counts = (...values: number[]) => ({
  get size() {
    return values.length > 1 ? (values.shift() ?? 0) : (values[0] ?? 0)
  },
})

describe('waiting for rooms to finish', () => {
  it('returns at once when no room is open', async () => {
    expect(await run(drainRooms(counts(0)))).toBe('empty')
  })

  it('polls until the last room closes', async () => {
    const result = await run(
      Effect.gen(function* () {
        const fiber = yield* Effect.fork(drainRooms(counts(2, 1, 0), { pollMs: 1_000 }))
        yield* TestClock.adjust(1_000)
        yield* TestClock.adjust(1_000)
        return yield* Fiber.join(fiber)
      }),
    )
    expect(result).toBe('empty')
  })

  it('gives up at the cap, never past it', async () => {
    const result = await run(
      Effect.gen(function* () {
        const fiber = yield* Effect.fork(drainRooms(counts(1), { capMs: 2_500, pollMs: 1_000 }))
        yield* TestClock.adjust(2_499)
        expect(fiber.unsafePoll()).toBeNull()
        yield* TestClock.adjust(1)
        return yield* Fiber.join(fiber)
      }),
    )
    expect(result).toBe('cap')
  })

  it('caps at five minutes by default', () => {
    expect(DRAIN_MAX_MS).toBe(300_000)
  })
})

describe('draining on SIGTERM', () => {
  it('drains once and exits 0, however many times the signal comes', async () => {
    const signals = new EventEmitter()
    const exits: number[] = []
    let drains = 0
    await run(
      Effect.gen(function* () {
        const scope = yield* Scope.make()
        const fiber = yield* Effect.forkDaemon(
          drainOnSigterm(
            signals,
            Effect.sync(() => {
              drains += 1
              return 'empty' as const
            }),
            (code) => exits.push(code),
          ).pipe(Scope.extend(scope)),
        )
        yield* Effect.yieldNow()
        signals.emit('SIGTERM')
        signals.emit('SIGTERM')
        yield* Effect.yieldNow()
        yield* Effect.yieldNow()
        // A second signal is caught and ignored, never left to Node's default handler, which would kill the games.
        expect(signals.listenerCount('SIGTERM')).toBe(1)
        yield* Fiber.interrupt(fiber)
        yield* Scope.close(scope, Exit.void)
        expect(signals.listenerCount('SIGTERM')).toBe(0)
      }),
    )
    expect(drains).toBe(1)
    expect(exits).toEqual([0])
  })

  it('exits 1 when the drain itself fails', async () => {
    const signals = new EventEmitter()
    const exits: number[] = []
    await run(
      Effect.scoped(
        Effect.gen(function* () {
          const fiber = yield* Effect.fork(
            drainOnSigterm(signals, Effect.fail(new Error('boom')), (code) => exits.push(code)),
          )
          yield* Effect.yieldNow()
          signals.emit('SIGTERM')
          yield* Effect.yieldNow()
          yield* Effect.yieldNow()
          yield* Fiber.interrupt(fiber)
        }),
      ),
    )
    expect(exits).toEqual([1])
  })
})

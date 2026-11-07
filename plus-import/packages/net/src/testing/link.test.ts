import { Effect, TestClock, TestContext } from 'effect'
import { describe, expect, it } from 'vitest'
import { createLink, type LinkOptions } from './link'

// createLink (M7 spec §4.7): every delay, loss, duplicate and reorder is drawn from the seed, on TestClock, so a
// failure replays exactly.

const quiet: LinkOptions = { seed: 1, latencyMs: 50, jitterMs: 0, loss: 0, duplicate: 0, reorder: 0 }
const run = <A>(program: Effect.Effect<A>): Promise<A> =>
  Effect.runPromise(program.pipe(Effect.provide(TestContext.TestContext)))

/**
 * Sends `count` messages client to server at t = 0, then steps the clock `STEP_MS` at a time; `[ms, message]`
 * arrivals, each stamped with the end of the step it arrived in. Every expected time below is a multiple of the step,
 * and a coarser step keeps the run short on a loaded runner (1 ms steps took over 5 s on the shared Mac).
 */
const STEP_MS = 5
const arrivals = (options: LinkOptions, count: number, untilMs = 120) =>
  Effect.gen(function* () {
    const { client, server } = createLink(options)
    const log: Array<[number, string]> = []
    let now = 0
    server.onMessage((data) => log.push([now, String(data)]))
    for (let i = 0; i < count; i++) yield* client.send(`m${i}`)
    for (now = STEP_MS; now <= untilMs; now += STEP_MS) yield* TestClock.adjust(`${STEP_MS} millis`)
    return log
  })

describe('createLink', () => {
  it('delivers nothing before the latency and everything at it', async () => {
    expect(await run(arrivals(quiet, 2))).toEqual([
      [50, 'm0'],
      [50, 'm1'],
    ])
  })

  it('carries both directions', async () => {
    const log = await run(
      Effect.gen(function* () {
        const { client, server } = createLink(quiet)
        const got: string[] = []
        client.onMessage((data) => got.push(`client got ${String(data)}`))
        server.onMessage((data) => got.push(`server got ${String(data)}`))
        yield* client.send('up')
        yield* server.send('down')
        yield* TestClock.adjust('50 millis')
        return got
      }),
    )
    expect(log.sort()).toEqual(['client got down', 'server got up'])
  })

  it('stops delivering to a listener that unsubscribed', async () => {
    const got = await run(
      Effect.gen(function* () {
        const { client, server } = createLink(quiet)
        const seen: unknown[] = []
        const off = server.onMessage((data) => seen.push(data))
        off()
        yield* client.send('x')
        yield* TestClock.adjust('1 seconds')
        return seen
      }),
    )
    expect(got).toEqual([])
  })

  it('does not deliver to a listener unsubscribed by an earlier listener during the same delivery', async () => {
    const got = await run(
      Effect.gen(function* () {
        const { client, server } = createLink(quiet)
        const seen: string[] = []
        let offSecond = (): void => {}
        server.onMessage(() => {
          seen.push('first')
          offSecond()
        })
        offSecond = server.onMessage(() => seen.push('second'))
        yield* client.send('x')
        yield* TestClock.adjust('1 seconds')
        return seen
      }),
    )
    expect(got).toEqual(['first'])
  })

  it('gives the same schedule for the same seed, and another for another seed', async () => {
    const noisy: LinkOptions = {
      seed: 7,
      latencyMs: 40,
      jitterMs: 30,
      loss: 0.2,
      duplicate: 0.2,
      reorder: 0.2,
    }
    const first = await run(arrivals(noisy, 40))
    expect(await run(arrivals(noisy, 40))).toEqual(first)
    expect(await run(arrivals({ ...noisy, seed: 8 }, 40))).not.toEqual(first)
  })

  it('loses everything at loss 1 and duplicates everything at duplicate 1', async () => {
    expect(await run(arrivals({ ...quiet, loss: 1 }, 5))).toEqual([])
    const doubled = await run(arrivals({ ...quiet, duplicate: 1 }, 3))
    expect(doubled.map(([, m]) => m).sort()).toEqual(['m0', 'm0', 'm1', 'm1', 'm2', 'm2'])
  })

  it('holds a reordered message back by one more latency', async () => {
    expect(await run(arrivals({ ...quiet, reorder: 1 }, 1))).toEqual([[100, 'm0']])
  })

  it('can deliver out of order under jitter and reorder', async () => {
    const log = await run(arrivals({ ...quiet, jitterMs: 40, reorder: 0.3 }, 20, 150))
    const order = log.map(([, m]) => Number(m.slice(1)))
    expect(order).not.toEqual([...order].sort((a, b) => a - b))
    expect([...order].sort((a, b) => a - b)).toEqual([...Array(20).keys()])
  })

  it.each([
    ['a negative latency', { ...quiet, latencyMs: -1 }],
    ['a fractional jitter', { ...quiet, jitterMs: 1.5 }],
    ['a loss past 1', { ...quiet, loss: 1.1 }],
    ['a negative duplicate', { ...quiet, duplicate: -0.1 }],
    ['a negative seed', { ...quiet, seed: -1 }],
    ['a seed past 2^31 - 1, which would wrap onto another seed', { ...quiet, seed: 2 ** 31 }],
    ['a seed that is not a whole number', { ...quiet, seed: 0.5 }],
  ])('refuses %s', (_, options) => {
    expect(() => createLink(options)).toThrow(RangeError)
  })
})

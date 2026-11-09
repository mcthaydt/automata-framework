import { fakeClock } from '@automata/framework/testing'
import { describe, expect, it } from 'vitest'
import { createLink, type LinkOptions } from '#src/testing/link.ts'

// createLink: every delay, loss, duplicate and reorder is drawn from the seed, on a fake clock, so a failure replays
// exactly.

const quiet: LinkOptions = { seed: 1, latencyMs: 50, jitterMs: 0, loss: 0, duplicate: 0, reorder: 0 }

/**
 * Sends `count` messages client to server at t = 0, then steps the clock `STEP_MS` at a time; `[ms, message]`
 * arrivals, each stamped with the end of the step it arrived in. Every expected time below is a multiple of the step,
 * and a coarser step keeps the run short on a loaded runner (1 ms steps took over 5 s on the shared Mac).
 */
const STEP_MS = 5
const arrivals = (options: LinkOptions, count: number, untilMs = 120) => {
  const clock = fakeClock()
  const { client, server } = createLink(options, clock)
  const log: Array<[number, string]> = []
  let now = 0
  server.onMessage((data) => log.push([now, String(data)]))
  for (let i = 0; i < count; i++) client.send(`m${i}`)
  for (now = STEP_MS; now <= untilMs; now += STEP_MS) clock.advance(STEP_MS)
  return log
}

describe('createLink', () => {
  it('delivers nothing before the latency and everything at it', () => {
    expect(arrivals(quiet, 2)).toEqual([
      [50, 'm0'],
      [50, 'm1'],
    ])
  })

  it('delivers at once on a link with no latency', () => {
    const clock = fakeClock()
    const { client, server } = createLink({ ...quiet, latencyMs: 0 }, clock)
    const seen: string[] = []
    server.onMessage((data) => seen.push(String(data)))
    client.send('x')
    expect(seen).toEqual(['x'])
    expect(clock.pending()).toBe(0)
  })

  it('carries both directions', () => {
    const clock = fakeClock()
    const { client, server } = createLink(quiet, clock)
    const got: string[] = []
    client.onMessage((data) => got.push(`client got ${String(data)}`))
    server.onMessage((data) => got.push(`server got ${String(data)}`))
    client.send('up')
    server.send('down')
    clock.advance(50)
    expect(got.sort()).toEqual(['client got down', 'server got up'])
  })

  it('stops delivering to a listener that unsubscribed', () => {
    const clock = fakeClock()
    const { client, server } = createLink(quiet, clock)
    const seen: unknown[] = []
    const off = server.onMessage((data) => seen.push(data))
    off()
    client.send('x')
    clock.advance(1000)
    expect(seen).toEqual([])
  })

  it('does not deliver to a listener unsubscribed by an earlier listener during the same delivery', () => {
    const clock = fakeClock()
    const { client, server } = createLink(quiet, clock)
    const seen: string[] = []
    let offSecond = (): void => {}
    server.onMessage(() => {
      seen.push('first')
      offSecond()
    })
    offSecond = server.onMessage(() => seen.push('second'))
    client.send('x')
    clock.advance(1000)
    expect(seen).toEqual(['first'])
  })

  it('leaves no timer behind once everything has arrived', () => {
    const clock = fakeClock()
    const { client, server } = createLink({ ...quiet, duplicate: 1 }, clock)
    server.onMessage(() => undefined)
    client.send('x')
    expect(clock.pending()).toBe(2)
    clock.advance(50)
    expect(clock.pending()).toBe(0)
  })

  it('gives the same schedule for the same seed, and another for another seed', () => {
    const noisy: LinkOptions = {
      seed: 7,
      latencyMs: 40,
      jitterMs: 30,
      loss: 0.2,
      duplicate: 0.2,
      reorder: 0.2,
    }
    const first = arrivals(noisy, 40)
    expect(arrivals(noisy, 40)).toEqual(first)
    expect(arrivals({ ...noisy, seed: 8 }, 40)).not.toEqual(first)
  })

  it('loses everything at loss 1 and duplicates everything at duplicate 1', () => {
    expect(arrivals({ ...quiet, loss: 1 }, 5)).toEqual([])
    const doubled = arrivals({ ...quiet, duplicate: 1 }, 3)
    expect(doubled.map(([, m]) => m).sort()).toEqual(['m0', 'm0', 'm1', 'm1', 'm2', 'm2'])
  })

  it('holds a reordered message back by one more latency', () => {
    expect(arrivals({ ...quiet, reorder: 1 }, 1)).toEqual([[100, 'm0']])
  })

  it('can deliver out of order under jitter and reorder', () => {
    const log = arrivals({ ...quiet, jitterMs: 40, reorder: 0.3 }, 20, 150)
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
    expect(() => createLink(options, fakeClock())).toThrow(RangeError)
  })
})

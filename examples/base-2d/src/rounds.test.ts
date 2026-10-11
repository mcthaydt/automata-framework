import { describe, expect, it } from 'vitest'
import { createRounds } from './rounds.ts'

interface FakeSim {
  readonly name: string
  disposed: number
  dispose(): void
}
const fake = (name: string): FakeSim => ({
  name,
  disposed: 0,
  dispose() {
    this.disposed++
  },
})

/** A sim factory whose results arrive only when the test settles them, one creation at a time. */
function slowFactory() {
  const pending: Array<{ resolve: (sim: FakeSim) => void; reject: (error: Error) => void }> = []
  let made = 0
  return {
    create: () =>
      new Promise<FakeSim>((resolve, reject) => {
        pending.push({ resolve, reject })
      }),
    inFlight: () => pending.length,
    resolveNext: () => {
      const sim = fake(`sim-${++made}`)
      pending.shift()?.resolve(sim)
      return sim
    },
    rejectNext: (error: Error) => pending.shift()?.reject(error),
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

function setup() {
  const first = fake('first')
  const factory = slowFactory()
  const ready: string[] = []
  const failures: unknown[] = []
  const rounds = createRounds(first, factory.create, {
    onReady: (sim) => ready.push(sim.name),
    onFailed: (error) => failures.push(error),
  })
  return { first, factory, ready, failures, rounds }
}

describe('rounds', () => {
  it('swaps in a fresh sim and disposes the old one once', async () => {
    const { first, factory, ready, rounds } = setup()
    rounds.start()
    expect(rounds.starting()).toBe(true)
    const fresh = factory.resolveNext()
    await flush()
    expect(rounds.current()).toBe(fresh)
    expect(rounds.starting()).toBe(false)
    expect(first.disposed).toBe(1)
    expect(ready).toEqual(['sim-1'])
  })

  it('makes one sim at a time, and only the newest start is kept', async () => {
    const { first, factory, ready, rounds } = setup()
    rounds.start()
    rounds.start()
    rounds.start()
    expect(factory.inFlight()).toBe(1)
    const stale = factory.resolveNext()
    await flush()
    expect(stale.disposed).toBe(1)
    expect(rounds.starting()).toBe(true)
    expect(factory.inFlight()).toBe(1)
    const newest = factory.resolveNext()
    await flush()
    expect(rounds.current()).toBe(newest)
    expect(first.disposed).toBe(1)
    expect(ready).toEqual(['sim-2'])
  })

  it('never has more than two sims alive, however fast rounds start (Koota allows 16 worlds)', async () => {
    const { factory, rounds } = setup()
    for (let i = 0; i < 20; i++) rounds.start()
    expect(factory.inFlight()).toBe(1)
    factory.resolveNext()
    await flush()
    expect(factory.inFlight()).toBe(1)
  })

  it('reports a failed sim, stops starting and leaves no unhandled rejection', async () => {
    const { factory, failures, ready, rounds } = setup()
    rounds.start()
    const error = new Error('Too many worlds')
    factory.rejectNext(error)
    await flush()
    expect(failures).toEqual([error])
    expect(ready).toEqual([])
    expect(rounds.starting()).toBe(false)
  })
})

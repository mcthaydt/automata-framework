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

/** A sim factory whose results arrive only when the test resolves them, in any order. */
function slowFactory() {
  const pending: Array<(sim: FakeSim) => void> = []
  let made = 0
  return {
    create: () =>
      new Promise<FakeSim>((resolve) => {
        pending.push(resolve)
      }),
    resolveNext: (index: number) => {
      const sim = fake(`sim-${++made}`)
      pending[index]?.(sim)
      return sim
    },
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('rounds', () => {
  it('swaps in a fresh sim and disposes the old one once', async () => {
    const first = fake('first')
    const factory = slowFactory()
    const ready: string[] = []
    const rounds = createRounds(first, factory.create, (sim) => ready.push(sim.name))
    rounds.start()
    expect(rounds.starting()).toBe(true)
    const fresh = factory.resolveNext(0)
    await flush()
    expect(rounds.current()).toBe(fresh)
    expect(rounds.starting()).toBe(false)
    expect(first.disposed).toBe(1)
    expect(ready).toEqual(['sim-1'])
  })

  it('keeps only the newest round when a second starts before the first sim arrives', async () => {
    const first = fake('first')
    const factory = slowFactory()
    const ready: string[] = []
    const rounds = createRounds(first, factory.create, (sim) => ready.push(sim.name))
    rounds.start()
    rounds.start()
    const stale = factory.resolveNext(0)
    const newest = factory.resolveNext(1)
    await flush()
    expect(rounds.current()).toBe(newest)
    expect(stale.disposed).toBe(1)
    expect(first.disposed).toBe(1)
    expect(ready).toEqual(['sim-2'])
  })

  it('stays starting until the newest sim arrives, whatever order they come in', async () => {
    const factory = slowFactory()
    const rounds = createRounds(fake('first'), factory.create, () => {})
    rounds.start()
    rounds.start()
    const newest = factory.resolveNext(1)
    await flush()
    expect(rounds.current()).toBe(newest)
    expect(rounds.starting()).toBe(false)
    const stale = factory.resolveNext(0)
    await flush()
    expect(rounds.current()).toBe(newest)
    expect(stale.disposed).toBe(1)
  })
})

// The nav plugin (M6 spec §4.4, §5, N-b): `walk-to` routes once and walks the walker's `InSector` plan position leg by
// leg at its speed; `nav.arrived` and `nav.unreachable` say how it ended; a door's change re-routes a walk once.
import type { Sim, SimEvent } from '@mcthaydt/automata-sim'
import { afterEach, describe, expect, it } from 'vitest'
import {
  at,
  createWalkGame,
  door,
  load,
  type Order,
  spawnWalker,
  stepWith,
  walkTo,
} from '../testing/walk-game'
import { NavDoors, NavRoutes } from './index'

let sims: Sim[] = []
afterEach(() => {
  for (const sim of sims) sim.dispose()
  sims = []
})
const game = async (): Promise<Sim> => {
  const sim = await createWalkGame()
  sims.push(sim)
  stepWith(sim, [load()])
  return sim
}
describe('the `locked` option', () => {
  it('ignores a new walk-to while it holds, and takes it once it does not (a cutscene is playing)', async () => {
    let locked = true
    const sim = await createWalkGame({ locked: () => locked })
    sims.push(sim)
    stepWith(sim, [load()])
    const walker = spawnWalker(sim, -3, 3)
    stepWith(sim, [walkTo(walker, 0, -5)])
    expect(at(sim, walker)).toEqual({ x: -3, z: 3 })
    expect(sim.resource(NavRoutes)).toEqual({})
    locked = false
    stepWith(sim, [walkTo(walker, 0, -5)])
    expect(at(sim, walker)).not.toEqual({ x: -3, z: 3 })
  })
})

const named = (events: readonly SimEvent[], type: string) => events.filter((e) => e.type === type)

/** Steps until `type` is emitted (or `limit` steps), and gives the events of every step on the way. */
function stepUntil(sim: Sim, type: string, orders: readonly Order[] = [], limit = 2_000): SimEvent[][] {
  const steps: SimEvent[][] = []
  for (let i = 0; i < limit; i++) {
    const { events } = stepWith(sim, i === 0 ? orders : [])
    steps.push([...events])
    if (named(events, type).length > 0) return steps
  }
  throw new Error(`no ${type} in ${limit} steps`)
}

describe('walk-to', () => {
  it('walks leg by leg at its speed, one step per tick, and arrives on the tick nav.arrived fires', async () => {
    const sim = await game()
    const walker = spawnWalker(sim, -3, 3, 1.5)
    const stride = 1.5 / sim.tickHz
    let last = at(sim, walker)
    let arrived: SimEvent[] = []
    for (let step = 0; arrived.length === 0; step++) {
      expect(step).toBeLessThan(2_000)
      arrived = named(stepWith(sim, step === 0 ? [walkTo(walker, 0, -5)] : []).events, 'nav.arrived')
      const now = at(sim, walker)
      expect(Math.hypot(now.x - last.x, now.z - last.z)).toBeLessThanOrEqual(stride + 1e-9)
      if (arrived.length === 0) expect(now).not.toEqual(last)
      last = now
    }
    expect(arrived).toEqual([{ type: 'nav.arrived', payload: { entity: walker, at: { x: 0, z: -5 } } }])
    expect(at(sim, walker)).toEqual({ x: 0, z: -5 })
    stepWith(sim)
    expect(at(sim, walker)).toEqual({ x: 0, z: -5 })
    expect(sim.resource(NavRoutes)).toEqual({})
  })

  it('moves exactly one stride on a straight first leg', async () => {
    const sim = await game()
    const walker = spawnWalker(sim, -3, 3, 1.5)
    stepWith(sim, [walkTo(walker, -3, 2)])
    expect(at(sim, walker).x).toBeCloseTo(-3, 12)
    expect(at(sim, walker).z).toBeCloseTo(3 - 1.5 / sim.tickHz, 12)
  })
})

describe('doors (N-b)', () => {
  it('a shut door makes the supply room unreachable: nav.unreachable, and the walker stands', async () => {
    const sim = await game()
    const walker = spawnWalker(sim, 0.3, -4)
    const { events } = stepWith(sim, [walkTo(walker, 3, -4)])
    expect(named(events, 'nav.unreachable')).toEqual([
      { type: 'nav.unreachable', payload: { entity: walker, to: { x: 3, z: -4 } } },
    ])
    expect(at(sim, walker)).toEqual({ x: 0.3, z: -4 })
  })

  it('nav.door opening it lets the next walk-to through', async () => {
    const sim = await game()
    const walker = spawnWalker(sim, 0.3, -4)
    stepWith(sim, [door('closetDoor', true)])
    expect(sim.resource(NavDoors).open).toEqual({ closetDoor: true })
    stepUntil(sim, 'nav.arrived', [walkTo(walker, 3, -4)])
    expect(at(sim, walker)).toEqual({ x: 3, z: -4 })
  })

  it("a door's change mid-walk re-routes the walk once, from where the walker stands", async () => {
    const sim = await game()
    const walker = spawnWalker(sim, -3, 3)
    stepWith(sim, [walkTo(walker, 0, -5)])
    const before = sim.resource(NavRoutes)[String(walker)]
    expect(before?.version).toBe(0)
    stepWith(sim, [door('closetDoor', true)])
    const after = sim.resource(NavRoutes)[String(walker)]
    expect(after?.version).toBe(1)
    stepWith(sim)
    expect(sim.resource(NavRoutes)[String(walker)]?.version).toBe(1)
    // Setting a door to what it already is is no change.
    stepWith(sim, [door('closetDoor', true)])
    expect(sim.resource(NavDoors).version).toBe(1)
  })
})

it('a restore mid-walk gives the same events and hash', async () => {
  const run = async (restoreAt?: number) => {
    let sim = await game()
    const walker = spawnWalker(sim, -3, 3)
    const lines: string[] = []
    for (let i = 0; i < 400; i++) {
      if (sim.tick === restoreAt) {
        const bytes = sim.snapshot()
        sim = await createWalkGame()
        sims.push(sim)
        sim.restore(bytes)
      }
      const orders = i === 0 ? [walkTo(walker, 0, -5)] : i === 150 ? [door('closetDoor', true)] : []
      for (const e of stepWith(sim, orders).events) lines.push(JSON.stringify(e))
    }
    return { hash: sim.hash(), lines }
  }
  const straight = await run()
  expect(straight.lines.some((l) => l.includes('nav.arrived'))).toBe(true)
  expect(await run(120)).toEqual(straight)
})

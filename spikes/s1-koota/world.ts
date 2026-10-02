import { createWorld, type Entity, relation, trait, type World } from 'koota'
import { nextRand } from '../shared/prng'

export const StableId = trait({ value: 0 })
export const Position = trait({ x: 0, y: 0 })
export const Velocity = trait({ x: 0, y: 0 })
export const Health = trait({ hp: 0 })
export const Contains = relation({ store: { amount: 0 } })

/** Everything a deterministic run depends on, besides the Koota world itself. */
export type Sim = {
  world: World
  nextId: number
  acc: number // order-sensitive fold: changes if iteration order changes
  rng: { s: number }
  destroyedKootaIds: Set<number>
}
export type Order = 'native' | 'sorted'

/** Koota caps the number of live worlds, so tests destroy every world they create. */
const created: World[] = []
export function createSim(seed: number): Sim {
  const world = createWorld()
  created.push(world)
  return { world, nextId: 1, acc: 0, rng: { s: seed >>> 0 }, destroyedKootaIds: new Set() }
}
export function destroyWorlds(): void {
  for (const w of created.splice(0)) w.destroy()
}

const r = (sim: Sim) => nextRand(sim.rng)
export const sidOf = (e: Entity): number => (e.get(StableId) as { value: number }).value

export function spawnBody(sim: Sim): Entity {
  const e = sim.world.spawn(
    StableId({ value: sim.nextId++ }),
    Position({ x: Math.fround(r(sim) * 100), y: Math.fround(r(sim) * 100) }),
    Velocity({ x: Math.fround(r(sim) - 0.5), y: Math.fround(r(sim) - 0.5) }),
  )
  if (r(sim) < 0.35) e.add(Health({ hp: Math.floor(r(sim) * 100) }))
  return e
}

/** Spawns exactly n bodies; every 10th gets a Contains relation (with data) to an earlier body. */
export function populate(sim: Sim, n: number): void {
  const spawned: Entity[] = []
  for (let i = 0; i < n; i++) {
    const e = spawnBody(sim)
    if (i % 10 === 9) {
      const target = spawned[Math.floor(r(sim) * spawned.length)]
      if (target) e.add(Contains(target, { amount: Math.floor(r(sim) * 10) }))
    }
    spawned.push(e)
  }
}

export function live(sim: Sim, order: Order): Entity[] {
  const list = [...sim.world.query(StableId)]
  return order === 'sorted' ? list.sort((a, b) => sidOf(a) - sidOf(b)) : list
}

/**
 * One fixed step whose outcome DEPENDS on iteration order:
 * - fold every live StableId into `acc` in iteration order,
 * - pick entities to destroy / mutate / relate by index into the ordered list,
 * - spawn during the step (exercises ID recycling).
 */
export function tick(sim: Sim, order: Order, dt = 1 / 60): void {
  sim.world.query(Position, Velocity).updateEach(([p, v]) => {
    p.x = Math.fround(p.x + v.x * dt)
    p.y = Math.fround(p.y + v.y * dt)
  })
  const list = live(sim, order)
  for (const e of list) sim.acc = (Math.imul(sim.acc, 31) + sidOf(e)) >>> 0
  const pick = () => list[Math.floor(r(sim) * list.length)]
  const victim = pick()
  if (victim) {
    sim.destroyedKootaIds.add(victim.id())
    victim.destroy()
  }
  spawnBody(sim)
  spawnBody(sim)
  const toggled = pick()
  if (toggled?.isAlive()) {
    if (toggled.has(Health)) toggled.remove(Health)
    else toggled.add(Health({ hp: Math.floor(r(sim) * 100) }))
  }
  const a = pick()
  const b = pick()
  if (a?.isAlive() && b?.isAlive() && a !== b) a.add(Contains(b, { amount: Math.floor(r(sim) * 10) }))
}

/** How many live entities reuse a Koota id that was destroyed earlier in this run. */
export function recycledLive(sim: Sim): number {
  return [...sim.world.query(StableId)].filter((e) => sim.destroyedKootaIds.has(e.id())).length
}

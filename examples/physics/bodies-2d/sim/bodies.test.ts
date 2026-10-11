import { moveCommand, ROOM } from '@af-examples/base-2d'
import { BodyKind, RigidBody2D, Transform2D } from '@mcthaydt/automata-physics/2d'
import type { Command, Sim } from '@mcthaydt/automata-sim'
import { afterEach, describe, expect, it } from 'vitest'
import { createBodiesSim } from '../bodies-sim.ts'
import { Drop, Follower, MAX_LOOSE } from './bodies.plugin.ts'

const sims: Sim[] = []
afterEach(() => {
  for (const sim of sims.splice(0)) sim.dispose()
})
const make = async () => {
  const sim = await createBodiesSim(ROOM)
  sims.push(sim)
  return sim
}

const drop = (sim: Sim): Command => ({
  tick: sim.tick,
  source: 0,
  seq: 0x80000000 + sim.tick,
  type: Drop.id,
  payload: {},
})
const loose = (sim: Sim) =>
  sim.query(RigidBody2D).filter((body) => body.get(RigidBody2D).kind === BodyKind.dynamic)

/** Runs `ticks` steps with Wick holding `x` and the given drops on the given ticks. */
function run(sim: Sim, ticks: number, x: -1 | 0 | 1 = 0, dropOn: readonly number[] = []) {
  for (let i = 0; i < ticks; i++) {
    const commands = [moveCommand(sim, { x, jump: false })]
    if (dropOn.includes(sim.tick)) commands.push(drop(sim))
    const result = sim.step(commands)
    expect(result.rejected).toEqual([])
  }
}

describe('bodies in the room', () => {
  it('starts with four crates and three stones, which fall and come to rest', async () => {
    const sim = await make()
    expect(loose(sim)).toHaveLength(7)
    const heights = () => loose(sim).map((body) => body.get(Transform2D).y)
    const start = heights()
    run(sim, 180)
    const settled = heights()
    run(sim, 30)
    expect(settled.some((y, i) => y < (start[i] as number) - 0.1)).toBe(true)
    // Resting: nothing moves more than a hair in another half second.
    for (const [i, y] of heights().entries()) expect(Math.abs(y - (settled[i] as number))).toBeLessThan(0.02)
    // Nothing fell through the floor (its top is half a metre up).
    for (const y of heights()) expect(y).toBeGreaterThan(0.5)
  })

  it('drops a body above Wick, and the box that follows Wick moves with Wick', async () => {
    const sim = await make()
    const follower = () =>
      (sim.query(Transform2D, Follower)[0] as NonNullable<ReturnType<Sim['entity']>>).get(Transform2D)
    const before = follower().x
    run(sim, 40, 1, [5])
    expect(loose(sim)).toHaveLength(8)
    expect(follower().x).toBeGreaterThan(before + 0.5)
  })

  it(`keeps at most ${MAX_LOOSE} loose bodies, removing the oldest`, async () => {
    const sim = await make()
    const first = loose(sim)[0]?.sid
    run(
      sim,
      MAX_LOOSE,
      0,
      Array.from({ length: MAX_LOOSE }, (_, i) => i),
    )
    expect(loose(sim)).toHaveLength(MAX_LOOSE)
    expect(loose(sim).map((body) => body.sid)).not.toContain(first)
  })

  it('gives the same pile for the same drops', async () => {
    const a = await make()
    const b = await make()
    run(a, 120, 1, [3, 20, 40])
    run(b, 120, 1, [3, 20, 40])
    expect(a.hash()).toBe(b.hash())
  })
})

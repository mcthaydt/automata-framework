import { moveCommand, ROOM } from '@af-examples/base-2d'
import { BodyKind, RigidBody2D, Transform2D } from '@mcthaydt/automata-physics/2d'
import type { Command, Sim } from '@mcthaydt/automata-sim'
import { afterEach, describe, expect, it } from 'vitest'
import { createBodiesSim } from '../bodies-sim.ts'
import { DROP_ABOVE, Drop, Follower, MAX_LOOSE, Prop, PropKind } from './bodies.plugin.ts'

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

  it('lets Wick shove the crate stack to the right', async () => {
    const sim = await make()
    const crates = () => loose(sim).filter((body) => body.get(Prop).kind === PropKind.crate)
    run(sim, 60) // let the stack settle first
    const before = Math.max(...crates().map((body) => body.get(Transform2D).x))
    run(sim, 90, 1)
    const after = Math.max(...crates().map((body) => body.get(Transform2D).x))
    expect(after).toBeGreaterThan(before + 0.25)
  })

  it('tags every loose body with what it looks like, and sends that to the renderer', async () => {
    const sim = await make()
    const kinds = loose(sim).map((body) => body.get(Prop).kind)
    expect(kinds.filter((kind) => kind === PropKind.crate)).toHaveLength(4)
    expect(kinds.filter((kind) => kind === PropKind.stone)).toHaveLength(3)
    // The first step's delta is a resync listing every rendered entity; the loose bodies come with their
    // Prop and Transform2D (RigidBody2D and Collider2D are not rendered, so the layer cannot tell them apart).
    const result = sim.step([moveCommand(sim, { x: 0, jump: false })])
    const props = result.render.added.filter((row) => row.components[Prop.id] !== undefined)
    expect(props).toHaveLength(7)
    for (const row of props) expect(row.components[Transform2D.id]).toBeDefined()
  })

  /** Drops one body on the next tick and returns where it is after that step, with Wick's centre before it. */
  function dropOne(sim: Sim) {
    const wick = (sim.query(Transform2D, Follower)[0] as NonNullable<ReturnType<Sim['entity']>>).get(
      Transform2D,
    )
    const ids = new Set(loose(sim).map((body) => body.sid))
    run(sim, 1, 0, [sim.tick])
    const dropped = loose(sim).find((body) => !ids.has(body.sid))
    if (dropped === undefined) throw new Error('nothing dropped')
    return { wick, at: dropped.get(Transform2D) }
  }

  it(`drops the new body ${DROP_ABOVE} m above Wick where nothing is in the way`, async () => {
    const sim = await make()
    run(sim, 60, -1) // to the left wall, where no platform hangs over Wick
    run(sim, 2) // stop, and let the box that follows Wick catch up
    const { wick, at } = dropOne(sim)
    expect(wick.x).toBeLessThan(1)
    // One step of gravity has already pulled it down a hair.
    expect(at.y).toBeGreaterThan(wick.y + DROP_ABOVE - 0.05)
    expect(at.y).toBeLessThanOrEqual(wick.y + DROP_ABOVE)
  })

  it('drops it above the platform instead when Wick stands under one', async () => {
    const sim = await make()
    run(sim, 2)
    // At the start Wick is under the low platform (row 20, its top 2 m up): 1.25 m above him is inside it.
    const { wick, at } = dropOne(sim)
    expect(wick.y + DROP_ABOVE).toBeLessThan(2.25)
    expect(at.y).toBeGreaterThan(wick.y + DROP_ABOVE + 0.45)
    expect(at.y).toBeLessThanOrEqual(wick.y + DROP_ABOVE + 0.5)
  })

  it('gives the same pile for the same drops', async () => {
    const a = await make()
    const b = await make()
    run(a, 120, 1, [3, 20, 40])
    run(b, 120, 1, [3, 20, 40])
    expect(a.hash()).toBe(b.hash())
  })
})

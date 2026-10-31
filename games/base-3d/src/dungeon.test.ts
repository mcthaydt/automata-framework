// base-3d's dungeon pieces in the sim (GAME-3D.1f, DESIGN.md §10). Part 1: the sling target, a lockable point the
// sling's pellets hit (§9.2: the aim rises to it), which reports the hit and never falls. The browsers project runs
// this file in Chromium, WebKit and Firefox too.
import type { Sim, SimEvent } from '@mcthaydt/automata-sim'
import { describe, expect, it } from 'vitest'
import { Fighter, SlingTarget, Target } from './components.ts'
import { metres } from './constants/index.ts'
import { ItemCode, SLING } from './constants/items.ts'
import { Inventory } from './resources.ts'
import { type AreaSource, compileArea } from './systems/index.ts'
import { commandsFor, startSim, type TickInput } from './testing/sim.ts'

/** Wick at the origin facing +z, with the area's `entities`, the sling owned and equipped with 10 pellets. */
async function piecesArea(entities: AreaSource['entities']): Promise<Sim> {
  const sim = await startSim(
    compileArea({
      id: 'pieces',
      spawn: { x: 0, z: 0 },
      views: [{ id: 'open', yawDeg: 0 }],
      rooms: [{ view: 'open', min: [-30, -30], max: [30, 30] }],
      walls: [],
      targets: [],
      ember: { x: 29, z: 29 },
      entities,
    }),
  )
  Object.assign(sim.resource(Inventory), { sling: true, equipped: ItemCode.sling, pellets: 10 })
  return sim
}

/** Steps `ticks` ticks with `input` held, and returns every event. */
function stepWith(sim: Sim, input: TickInput, ticks = 1): SimEvent[] {
  const events: SimEvent[] = []
  for (let i = 0; i < ticks; i++) events.push(...sim.step(commandsFor(sim, input)).events)
  return events
}
const eyeOn = [{ def: 'sling-target', id: 'eye-1', x: 0, z: 8, height: 2.6 }] as const

describe('the sling target (GAME-3D.1f part 1, DESIGN.md §10)', () => {
  it('stands where the area puts it, lockable, its hurt cylinder at its height', async () => {
    const sim = await piecesArea([...eyeOn])
    const [eye] = sim.query(SlingTarget)
    expect(eye?.get(SlingTarget)).toEqual({ piece: 1 })
    expect(eye?.get(Target)).toMatchObject({ x: 0, z: metres(8) })
    const { side, lift, height, health } = eye?.get(Fighter) ?? {}
    expect(side).toBe(1)
    // Its middle is at the height the area gives it, where the sling's aim rises to (§9.2).
    expect((lift ?? 0) + Math.trunc((height ?? 0) / 2)).toBe(metres(2.6))
    expect(health).toBeGreaterThan(0)
    sim.dispose()
  })

  it('takes a pellet: the shot rises to it, it reports the hit by its piece, and it never falls', async () => {
    const sim = await piecesArea([...eyeOn])
    const [eye] = sim.query(SlingTarget)
    const before = eye?.get(Fighter).health
    const events = [...stepWith(sim, { act: { item: true } }, SLING.draw), ...stepWith(sim, {}, 40)]
    const hits = events.filter((event) => event.type === 'sling-target.hit')
    expect(hits.map((event) => event.payload)).toEqual([{ piece: 1 }])
    expect(sim.entity(eye?.sid ?? 0)?.get(Fighter).health).toBe(before)
    sim.dispose()
  })

  it('reports no hit from the sword', async () => {
    const sim = await piecesArea([{ def: 'sling-target', id: 'lantern', x: 0, z: 1, height: 0.5 }])
    const events = [...stepWith(sim, { act: { slash: true } }), ...stepWith(sim, {}, 30)]
    expect(events.some((event) => event.type === 'hit.landed')).toBe(true)
    expect(events.some((event) => event.type === 'sling-target.hit')).toBe(false)
    sim.dispose()
  })
})

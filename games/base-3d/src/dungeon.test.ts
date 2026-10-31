// base-3d's dungeon pieces in the sim (GAME-3D.1f, DESIGN.md §10). Part 1: the sling target, a lockable point the
// sling's pellets hit (§9.2: the aim rises to it), which reports the hit and never falls. The browsers project runs
// this file in Chromium, WebKit and Firefox too.
import type { Sim, SimEvent } from '@mcthaydt/automata-sim'
import { describe, expect, it } from 'vitest'
import { Door, Enemy, Fighter, Hero, SlingTarget, Target } from './components.ts'
import { HERO_HALF, metres } from './constants/index.ts'
import { ItemCode, SLING } from './constants/items.ts'
import { Dungeon, Inventory } from './resources.ts'
import { base3dSaves } from './screens/saves.ts'
import { newGame } from './state/save.ts'
import { type AreaSource, compileArea } from './systems/index.ts'
import { commandsFor, hero, startSim, type TickInput, UP } from './testing/sim.ts'

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

/**
 * Two rooms, `south` (z −10 to 0) and `north` (z 0 to 10), split by a wall along z = 0 with a 2 m doorway at x = 0
 * that the door `door-1` fills; Wick starts 2 m south of it, facing it.
 */
async function doorway(
  door: Record<string, unknown>,
  more: AreaSource['entities'] = [],
  foesIn: AreaSource['foes'] = [],
) {
  const sim = await startSim(
    compileArea({
      id: 'pieces',
      spawn: { x: 0, z: -2 },
      views: [
        { id: 'south', yawDeg: 0 },
        { id: 'north', yawDeg: 0 },
      ],
      rooms: [
        { view: 'south', min: [-10, -10], max: [10, 0] },
        { view: 'north', min: [-10, 0], max: [10, 10] },
      ],
      walls: [
        { min: [-10, -0.15], max: [-1, 0.15] },
        { min: [1, -0.15], max: [10, 0.15] },
      ],
      targets: [],
      ember: { x: 9, z: 9 },
      foes: foesIn,
      entities: [{ def: 'door', id: 'door-1', x: 0, z: 0, width: 2, depth: 0.3, ...door }, ...(more ?? [])],
    }),
  )
  Object.assign(sim.resource(Inventory), { sling: true, equipped: ItemCode.sling, pellets: 10 })
  return sim
}
const doorOpen = (sim: Sim) => sim.query(Door)[0]?.get(Door).open
/** Walks Wick north `ticks` ticks. */
const walkNorth = (sim: Sim, ticks: number) => stepWith(sim, { stick: UP }, ticks)
/** Walks up to the door and presses pick up beside it: the events of the press. */
function tryTheDoor(sim: Sim): SimEvent[] {
  walkNorth(sim, 40)
  return [...stepWith(sim, { act: { pickup: true } }), ...stepWith(sim, {}, 2)]
}

describe('doors (GAME-3D.1f part 2, DESIGN.md §10)', () => {
  it('stands closed as a wall: Wick stops at its face', async () => {
    const sim = await doorway({ lock: 'small-key' })
    expect(doorOpen(sim)).toBe(false)
    walkNorth(sim, 60)
    expect(hero(sim).z).toBeLessThanOrEqual(metres(-0.15) - HERO_HALF)
    sim.dispose()
  })

  it('opens a small-key door with a key from beside it, spending the key once, and lets Wick through', async () => {
    const shut = await doorway({ lock: 'small-key' })
    expect(tryTheDoor(shut).some((event) => event.type === 'door.opened')).toBe(false)
    expect(doorOpen(shut)).toBe(false)
    shut.dispose()

    const sim = await doorway({ lock: 'small-key' })
    sim.resource(Dungeon).smallKeys = 2
    const events = tryTheDoor(sim)
    expect(events.filter((event) => event.type === 'door.opened').map((event) => event.payload)).toEqual([
      { piece: 1 },
    ])
    expect(doorOpen(sim)).toBe(true)
    expect(sim.resource(Dungeon)).toMatchObject({ smallKeys: 1, flags: ['pieces/door-1'] })
    // A second press at the open door spends nothing.
    stepWith(sim, { act: { pickup: true } })
    expect(sim.resource(Dungeon).smallKeys).toBe(1)
    walkNorth(sim, 60)
    expect(hero(sim).z).toBeGreaterThan(metres(1))
    sim.dispose()
  })

  it('opens the boss door with the boss key, and a plain door with no key', async () => {
    const boss = await doorway({ lock: 'boss-key' })
    boss.resource(Dungeon).bossKey = true
    tryTheDoor(boss)
    expect(doorOpen(boss)).toBe(true)
    expect(boss.resource(Dungeon).bossKey).toBe(false)
    boss.dispose()
    const plain = await doorway({ lock: 'none' })
    tryTheDoor(plain)
    expect(doorOpen(plain)).toBe(true)
    plain.dispose()
  })

  it('opens a clear door once its rooms have no foe standing, and keeps it open', async () => {
    const sim = await doorway({ lock: 'clear' }, [], [{ kind: 'sootling', x: 6, z: -8, facing: 0 }])
    stepWith(sim, {}, 2)
    expect(doorOpen(sim)).toBe(false)
    for (const foe of sim.query(Enemy)) foe.set(Fighter, { health: 0 })
    const events = stepWith(sim, {}, 2)
    expect(events.some((event) => event.type === 'door.opened')).toBe(true)
    expect(doorOpen(sim)).toBe(true)
    expect(sim.resource(Dungeon).flags).toEqual(['pieces/door-1'])
    sim.dispose()
  })

  it('stops a pellet at a closed door: the eye behind it is not hit', async () => {
    const sim = await doorway({ lock: 'small-key' }, [
      { def: 'sling-target', id: 'eye', x: 0, z: 4, height: 1.2 },
    ])
    const events = [...stepWith(sim, { act: { item: true } }, SLING.draw), ...stepWith(sim, {}, 40)]
    expect(events.some((event) => event.type === 'sling-target.hit')).toBe(false)
    sim.dispose()
  })
})

describe('the dungeon through the save (GAME-3D.1f part 2, DESIGN.md §10, §12.1)', () => {
  it('restores opened doors, keys, the map and compass, and captures them back with the rooms visited', async () => {
    const sim = await doorway({ lock: 'small-key' })
    const saves = base3dSaves()
    saves.apply(sim, {
      ...newGame(),
      flags: ['pieces/door-1', 'hub/met-lamplighter'],
      kiln: { ...newGame().kiln, smallKeys: 1, map: true, visited: ['south'] },
    })
    expect(sim.resource(Dungeon)).toMatchObject({ smallKeys: 1, map: true, visited: ['south'] })
    stepWith(sim, {})
    expect(doorOpen(sim)).toBe(true)
    walkNorth(sim, 80)
    const saved = saves.capture(sim)
    expect(saved.flags).toEqual(['hub/met-lamplighter', 'pieces/door-1'])
    expect(saved.kiln).toMatchObject({ smallKeys: 1, map: true, compass: false, visited: ['north', 'south'] })
    sim.dispose()
  })

  it('records each room Wick enters as visited', async () => {
    const sim = await doorway({ lock: 'none' })
    stepWith(sim, {})
    expect(sim.resource(Dungeon).visited).toEqual(['south'])
    tryTheDoor(sim)
    walkNorth(sim, 60)
    expect(sim.resource(Dungeon).visited).toEqual(['north', 'south'])
    expect(sim.query(Hero)).toHaveLength(1)
    sim.dispose()
  })
})

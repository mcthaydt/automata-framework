import { cameraHeadingPlugin, cameraView } from '@automata/3d/sim'
import { recordGoldenEvidence } from '@automata/evidence/golden'
import { createSim, type Sim } from '@automata/sim'
import { describe, expect, it } from 'vitest'
import { Ember, Hero, HeroAction } from './components.ts'
import { HERO_HALF, metres, ROLL, WALK_PER_TICK } from './constants/index.ts'
import { Location, Progress } from './resources.ts'
import { base3dPlugin } from './state/index.ts'
import { type AreaSource, areaOf, compileArea, viewAt } from './systems/index.ts'
import {
  BASE3D_SIM,
  commandsFor,
  GAME_SIM,
  hero,
  openArea,
  RIGHT,
  ROOM_AREA,
  run,
  startSim,
  type TickInput,
  UP,
} from './testing/sim.ts'

// base-3d's sim, the free game: commands in, step, state out. The browsers project runs this whole file in Chromium,
// WebKit and Firefox, so every case here, the golden replay included, holds in four engines (B-a, F3-b).
const LEFT = { x: -127, y: 0 }

describe('the plugin', () => {
  it('registers beside the camera-heading plugin it depends on', async () => {
    const sim = await createSim({ seed: 1, plugins: [cameraHeadingPlugin, base3dPlugin] })
    expect(sim.hash()).toMatch(/^[0-9a-f]{16}$/)
    sim.dispose()
  })
})

describe('the area', () => {
  const tiny: AreaSource = {
    id: 'tiny',
    spawn: { x: 0.5, z: -1.25 },
    views: [{ id: 'hall', yawDeg: 90 }],
    rooms: [{ view: 'hall', min: [-2, -2], max: [2, 2] }],
    walls: [{ min: [-2.1, 2], max: [2.1, 2.2] }],
    pits: [{ min: [1, 0], max: [2, 1] }],
    embers: [{ x: -1, z: 1.5 }],
    goal: { x: 1, z: 1.5 },
  }

  it('compiles metres to Q16.16 integers and fills the views’ defaults', () => {
    const area = compileArea(tiny)
    expect(area.spawn).toEqual({ x: 32_768, z: -81_920 })
    expect(area.rooms).toEqual([
      { view: 'hall', minX: -131_072, minZ: -131_072, maxX: 131_072, maxZ: 131_072 },
    ])
    expect(area.pits).toEqual([{ minX: 65_536, minZ: 0, maxX: 131_072, maxZ: 65_536 }])
    expect(area.embers).toEqual([{ x: -65_536, z: 98_304 }])
    expect(area.goal).toEqual({ x: 65_536, z: 98_304 })
    expect(area.views).toEqual([cameraView('hall', { yawDeg: 90 })])
  })

  it('refuses a room naming an unknown view, a repeated view, an unknown field and an ember outside every room', () => {
    expect(() => compileArea({ ...tiny, rooms: [{ view: 'kiln', min: [0, 0], max: [1, 1] }] })).toThrow(
      /kiln/,
    )
    expect(() => compileArea({ ...tiny, views: [{ id: 'hall' }, { id: 'hall' }] })).toThrow(/twice/)
    expect(() => compileArea({ ...tiny, extra: 1 } as unknown as AreaSource)).toThrow()
    expect(() => compileArea({ ...tiny, goal: { x: 9, z: 9 } })).toThrow(/outside every room/)
  })

  it('refuses a spawn whose square overlaps a wall, or that lies outside every room', () => {
    expect(() => compileArea({ ...tiny, spawn: { x: 0, z: 1.8 } })).toThrow(/wall/)
    expect(() => compileArea({ ...tiny, spawn: { x: 5, z: 0 } })).toThrow(/outside/)
  })

  it('reads only an area as the sim’s content', () => {
    expect(areaOf(compileArea(tiny)).id).toBe('tiny')
    expect(() => areaOf({})).toThrow(/not an area/)
  })

  it('compiles the room: three rooms, two pits, five embers and a goal', () => {
    expect(ROOM_AREA.rooms.map((room) => room.view)).toEqual(['start', 'middle', 'goal'])
    expect(ROOM_AREA.pits).toHaveLength(2)
    expect(ROOM_AREA.embers).toHaveLength(5)
  })
})

describe('setup', () => {
  it('places Wick at the spawn in its room’s view, and an ember at each ember point and at the goal', async () => {
    const sim = await startSim()
    const wick = hero(sim)
    expect(wick).toMatchObject({ x: ROOM_AREA.spawn.x, z: ROOM_AREA.spawn.z, view: 'start', latched: false })
    expect(sim.query(Ember)).toHaveLength(6)
    expect(sim.query(Ember).filter((entity) => entity.get(Ember).goal)).toHaveLength(1)
    expect(sim.resource(Progress)).toEqual({ taken: [], goal: false })
    sim.dispose()
  })
})

describe('moving', () => {
  it('pushes Wick away from the camera at 4 m/s: +z at heading 0, +x at 90°', async () => {
    const north = await startSim(openArea(0))
    run(north, { stick: UP }, 10)
    expect(hero(north).z).toBe(10 * WALK_PER_TICK)
    const east = await startSim(openArea(90))
    run(east, { stick: UP }, 10)
    expect(hero(east).x).toBe(10 * WALK_PER_TICK)
    north.dispose()
    east.dispose()
  })

  it('faces the way it travels and keeps that facing when the stick is released', async () => {
    const sim = await startSim(openArea(0))
    run(sim, { stick: RIGHT }, 5)
    const facing = hero(sim).facing
    expect(facing).toBeGreaterThan(0)
    run(sim, {}, 5)
    expect(hero(sim).facing).toBe(facing)
    expect(hero(sim).moving).toBe(false)
    sim.dispose()
  })
})

describe('the roll (F3-g)', () => {
  const edge = (): number => ROOM_AREA.pits[0]?.minZ ?? 0

  /** Walks Wick up the room's middle until his centre is a hair short of the first channel, rolled or not. */
  async function atTheChannel(): Promise<Sim> {
    const sim = await startSim()
    while (hero(sim).z + WALK_PER_TICK < edge() - HERO_HALF) run(sim, { stick: UP })
    return sim
  }

  it('carries him ROLL.travel in the way he faces over ROLL.ticks, and he lands past the channel', async () => {
    const sim = await atTheChannel()
    const before = hero(sim).z
    run(sim, { stick: UP, roll: true })
    expect(sim.query(Hero, HeroAction)[0]?.get(HeroAction).pushTicks).toBe(ROLL.ticks - 1)
    run(sim, { stick: UP }, ROLL.ticks - 1)
    const landed = hero(sim).z
    // The push is truncated a tick: within one unit a tick of the exact carry.
    expect(Math.abs(landed - before - ROLL.travel)).toBeLessThan(ROLL.ticks)
    expect(landed).toBeGreaterThan(ROOM_AREA.pits[0]?.maxZ ?? 0)
    expect(viewAt(ROOM_AREA, hero(sim).x, landed)?.id).toBe('middle')
    expect(sim.resource(Progress)).toEqual({ taken: [], goal: false })
    sim.dispose()
  })

  it('does not roll again while holding the button, nor while one runs', async () => {
    const sim = await atTheChannel()
    run(sim, { stick: UP, roll: true }, ROLL.ticks + 5)
    const action = sim.query(Hero, HeroAction)[0]?.get(HeroAction)
    expect(action?.pushTicks).toBe(0)
    expect(action?.startedAt).toBe(sim.query(Hero, HeroAction)[0]?.get(HeroAction).startedAt)
    sim.dispose()
  })

  it('walking into the channel puts Wick back on the last safe spot, with his embers kept', async () => {
    const sim = await startSim()
    sim.resource(Progress).taken = [0, 1]
    const events = run(sim, { stick: UP }, 140)
    expect(events.filter((event) => event.startsWith('hero.fell'))).toHaveLength(1)
    expect(hero(sim).z).toBeLessThan(edge())
    expect(sim.resource(Progress).taken).toEqual([0, 1])
    const place = sim.resource(Location)
    expect(place.returnZ).toBe(ROOM_AREA.spawn.z)
    sim.dispose()
  })

  it('a roll that ends in a channel falls too', async () => {
    const sim = await startSim()
    // From the spawn the lunge is 3.2 m: it ends at z = 4.7, in the start room; walk to 5.4 so it ends in the channel.
    while (hero(sim).z < metres(5.4)) run(sim, { stick: UP })
    const events = [...run(sim, { stick: UP, roll: true }), ...run(sim, { stick: UP }, ROLL.ticks)]
    expect(events.some((event) => event.startsWith('hero.fell'))).toBe(true)
    sim.dispose()
  })
})

describe('embers and the goal', () => {
  it('takes an ember by walking to it, once, and ends the run on the goal', async () => {
    const sim = await startSim(
      compileArea({
        id: 'two',
        spawn: { x: 0, z: 0 },
        views: [{ id: 'open', yawDeg: 0 }],
        rooms: [{ view: 'open', min: [-5, -5], max: [5, 5] }],
        walls: [],
        pits: [],
        embers: [{ x: 0, z: 1 }],
        goal: { x: 0, z: 2.5 },
      }),
    )
    const events = run(sim, { stick: UP }, 60)
    expect(events.filter((event) => event.startsWith('ember.taken'))).toHaveLength(2)
    expect(events.filter((event) => event.startsWith('goal.reached'))).toHaveLength(1)
    expect(sim.resource(Progress)).toEqual({ taken: [0, 1], goal: true })
    expect(sim.query(Ember)).toHaveLength(0)
    sim.dispose()
  })
})

describe('camera-turn (@automata/3d’s command, on Wick’s heading)', () => {
  it('turns the heading, and the stick with it, from the same tick', async () => {
    const sim = await startSim(openArea(0))
    run(sim, { stick: UP, turn: 8_192 })
    expect(hero(sim).heading).toBe(8_192)
    sim.dispose()
  })

  it('changes nothing in a view with rotate: false', async () => {
    const sim = await startSim(openArea(0, false))
    run(sim, { turn: 4_000 })
    expect(hero(sim).heading).toBe(0)
    sim.dispose()
  })
})

// The golden replay: a route through the room that walks to ember points, falls into the first channel once, rolls across
// both channels and takes the goal. Its hash covers the schema, the content (the room) and the state, so any change to the
// sim, the room or the tuning moves it; it must be the same in Node, Chromium, WebKit and Firefox (F3-b), never rebaselined
// to hide a mismatch between engines.
const GOLDEN_ROUTE: readonly (readonly [TickInput, number])[] = [
  [{ stick: RIGHT }, 45],
  [{ stick: UP }, 24],
  [{ stick: LEFT }, 90],
  [{ stick: RIGHT }, 45],
  [{ stick: UP }, 90],
  [{ stick: UP }, 74],
  [{ stick: UP, roll: true }, 1],
  [{ stick: UP }, 75],
  [{ stick: LEFT }, 45],
  [{ stick: RIGHT }, 90],
  [{ stick: LEFT }, 45],
  [{ stick: UP }, 40],
  [{ stick: UP, roll: true }, 1],
  [{ stick: UP }, 110],
]
// Re-recorded for the quality pass (was `4a218c05e968f861`): the schema gained the `hero.rolled` event and the `hero.move` system emits
// it on the tick a roll starts (the roll's sound plays from it). Nothing else in the sim or the room changed: the route's falls,
// rolls, embers and goal are the same ticks, and still asserted above.
const GOLDEN_HASH = 'c735b5acacbbc716'

async function runGolden() {
  const sim = await createSim(GAME_SIM)
  BASE3D_SIM.setup(sim)
  const startTick = sim.tick
  let rejected = 0
  const events: string[] = []
  const rolls: string[] = []
  for (const [input, ticks] of GOLDEN_ROUTE)
    for (let i = 0; i < ticks; i++) {
      const result = sim.step(commandsFor(sim, input))
      rejected += result.rejected.length
      for (const event of result.events) events.push(`${event.type}@${result.tick}`)
      const action = sim.query(Hero, HeroAction)[0]?.get(HeroAction)
      if (action !== undefined && action.clip !== 0 && rolls[rolls.length - 1] !== `roll@${action.startedAt}`)
        rolls.push(`roll@${action.startedAt}`)
    }
  const result = {
    hash: sim.hash(),
    rejected,
    events,
    rolls,
    progress: { ...sim.resource(Progress) },
    hero: hero(sim),
    ticks: sim.tick - startTick,
  }
  sim.dispose()
  return { ...result, seed: BASE3D_SIM.seed }
}

describe('the golden replay (B-a)', () => {
  it('walks the route, falls once, rolls across both channels, takes the goal, and ends on the recorded hash', async ({
    task,
  }) => {
    const result = await runGolden()
    expect(result.rejected).toBe(0)
    // The route's first walk into the channel falls (tick 278) and is put back; then it rolls across each channel.
    expect(result.events).toEqual([
      'ember.taken@59',
      'ember.taken@151',
      'hero.fell@278',
      'hero.rolled@369',
      'ember.taken@481',
      'ember.taken@571',
      'hero.rolled@665',
      'ember.taken@769',
      'goal.reached@769',
    ])
    expect(result.rolls).toEqual(['roll@368', 'roll@664'])
    expect(result.progress.goal).toBe(true)
    expect(result.progress.taken).toHaveLength(5)
    expect(result.hero).toMatchObject({ view: 'goal' })
    console.log(
      JSON.stringify({
        events: result.events,
        rolls: result.rolls,
        progress: result.progress,
        hero: result.hero,
        hash: result.hash,
      }),
    )
    expect(result.hash).toBe(GOLDEN_HASH)
    const { seed, ticks, hash } = result
    recordGoldenEvidence(task, { scenario: 'base-3d/golden-route', seed, ticks, hash })
  })

  it('replays to the same hash twice in one engine', async () => {
    const first = await runGolden()
    const second = await runGolden()
    expect(second.hash).toBe(first.hash)
  })
})

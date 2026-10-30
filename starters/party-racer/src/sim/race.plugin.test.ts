import { RigidBody2D, Transform2D } from '@mcthaydt/automata-physics/2d'
import { type Command, createSim, type EntityRef, type Sim, type SimEvent } from '@mcthaydt/automata-sim'
import { afterEach, describe, expect, it } from 'vitest'
import { PLACEHOLDER_COURSE_SEED, PLACEHOLDER_TUNING } from '../content/placeholder.content'
import { Floor, Race, RaceInput, RaceReset, Racer, RaceStart, racePlugins } from './index'

// The race step on Rapier (FloorFifty's `planck-simulation.ts` tick order), through the sim as a room would drive it:
// `race.start` from the room's source, then each seat's `race.input` and `race.reset`.

const tuning = PLACEHOLDER_TUNING
const ROOM = 255
const SPAWN_Y = Math.fround(tuning.floorHeight / 2 + tuning.racerHeight / 2) // an f32 field
const LEAVING = { vy: -1 } // falling onto whatever is below

let sim: Sim
let seq = 0
afterEach(() => sim?.dispose())

const command = (source: number, type: string, payload: unknown): Command => ({
  tick: sim.tick,
  source,
  seq: seq++,
  type,
  payload,
})
const input = (seat: number, held: { left?: boolean; right?: boolean; fastFall?: boolean }): Command =>
  command(seat, RaceInput.id, { left: false, right: false, fastFall: false, ...held })

async function startRace(seats = [0, 1, 2, 3]): Promise<SimEvent[]> {
  sim = await createSim({ seed: 1, plugins: racePlugins(tuning) })
  seq = 0
  return [...sim.step([command(ROOM, RaceStart.id, { courseSeed: PLACEHOLDER_COURSE_SEED, seats })]).events]
}
const racer = (seat: number): EntityRef => {
  const found = sim.query(Racer).find((e) => e.get(Racer).seat === seat)
  if (!found) throw new Error(`no racer in seat ${seat}`)
  return found
}
const floor = (index: number): EntityRef => {
  const found = sim.query(Floor).find((e) => e.get(Floor).index === index)
  if (!found) throw new Error(`no floor ${index}`)
  return found
}
const pos = (seat: number) => racer(seat).get(Transform2D)
const vel = (seat: number) => racer(seat).get(RigidBody2D)
/** Steps `n` ticks with `commands` on the first, and returns every event of those ticks. */
const run = (n: number, commands: Command[] = []): SimEvent[] => {
  const events: SimEvent[] = []
  for (let i = 0; i < n; i++) events.push(...sim.step(i === 0 ? commands : []).events)
  return events
}
const raceEvents = (events: SimEvent[]) => events.filter((e) => e.type.startsWith('race.'))
/** Puts a racer that has played somewhere, moving at `v`: a test's setup, outside the race's own rules. */
function place(seat: number, at: { x: number; y: number }, v: { vx?: number; vy?: number } = {}): void {
  run(1, [input(seat, { left: true })])
  run(1, [input(seat, {})])
  racer(seat).set(Transform2D, { x: at.x, y: at.y, rotation: 0 })
  racer(seat).set(RigidBody2D, { vx: v.vx ?? 0, vy: v.vy ?? 0 })
}

describe('race.start', () => {
  it('spawns every floor and a racer per seat at the spawn, waiting for its first input', async () => {
    await startRace([2, 0, 3, 1])
    expect(sim.query(Floor).map((e) => e.get(Floor).index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    expect(sim.query(Racer).map((e) => e.get(Racer).seat)).toEqual([0, 1, 2, 3])
    for (const seat of [0, 1, 2, 3]) {
      expect(pos(seat)).toEqual({ x: 0, y: SPAWN_Y, rotation: 0 })
      expect(racer(seat).get(Racer)).toMatchObject({ lap: 1, awaitingInput: true, finishedAt: -1 })
    }
    expect(sim.resource(Race)).toMatchObject({ phase: 'racing', startedAt: 0, standings: [], winner: -1 })
  })

  it('is taken once: a second start while racing is ignored', async () => {
    await startRace([0])
    run(1, [command(ROOM, RaceStart.id, { courseSeed: 5, seats: [0, 1] })])
    expect(sim.query(Racer)).toHaveLength(1)
  })
})

describe('the race step', () => {
  it('leaves a racer standing at the spawn until their first input', async () => {
    await startRace()
    run(60)
    expect(pos(0)).toEqual({ x: 0, y: SPAWN_Y, rotation: 0 })
  })

  it('starts the bounce on the first input and steers at moveSpeed while held', async () => {
    await startRace()
    run(1, [input(0, { right: true })])
    expect(pos(0).y).toBeGreaterThan(SPAWN_Y)
    expect(vel(0).vx).toBeCloseTo(tuning.moveSpeed, 5)
    expect(pos(1)).toEqual({ x: 0, y: SPAWN_Y, rotation: 0 })
  })

  it('stops dead when the steer is released', async () => {
    await startRace()
    place(0, { x: 0, y: 30 }) // in open air: near a floor, Rapier's push-out may still move a racer
    run(10, [input(0, { right: true })])
    run(1, [input(0, {})])
    const x = pos(0).x
    run(10)
    expect(vel(0).vx).toBe(0)
    expect(pos(0).x).toBe(x)
  })

  it('bounces off the start floor on every landing and never comes to rest', async () => {
    await startRace()
    run(1, [input(0, { left: true })])
    run(1, [input(0, {})])
    let landings = 0
    let below = false
    for (let i = 0; i < 300; i++) {
      run(1)
      if (racer(0).get(Racer).grounded) landings++
      // A landing may sink up to one tick's fall before the bounce lifts it (Rapier has no swept test here, and the
      // bounce leaves before the push-out finishes), but never more: the racer does not come to rest or fall through.
      if (pos(0).y < SPAWN_Y - tuning.bounceVelocity / 60) below = true
    }
    expect(landings).toBeGreaterThanOrEqual(3)
    expect(below).toBe(false)
  })

  it('credits a floor the racer lands on, once per ascent', async () => {
    await startRace()
    const f = floor(1).get(Transform2D)
    place(0, { x: f.x, y: f.y + 1.2 }, LEAVING)
    const events = raceEvents(run(60))
    expect(events.filter((e) => e.type === 'race.floor-landed')).toEqual([
      { type: 'race.floor-landed', payload: { seat: 0, floor: 1 } },
    ])
    expect(racer(0).get(Racer).visited).toBe('11000000')
  })

  it('lifts a racer pressing into a floor side without crediting it', async () => {
    await startRace()
    // A still floor, so it is where it was read when the racer reaches it.
    const still = sim.query(Floor).find((e) => !e.get(Floor).moving && e.get(Floor).index > 0)
    if (!still) throw new Error('the placeholder course has a still floor above the start')
    const f = still.get(Transform2D)
    const beside = f.x - (tuning.floorWidth + tuning.racerWidth) / 2 - 0.01
    place(0, { x: beside, y: f.y }, { vx: tuning.moveSpeed })
    const events = raceEvents(run(1, [input(0, { right: true })]))
    expect(vel(0).vy).toBeCloseTo(tuning.bounceVelocity, 5)
    expect(events).toEqual([])
  })

  it('carries a racer standing on a moving floor by the floor’s travel', async () => {
    await startRace()
    const moving = sim.query(Floor).find((e) => e.get(Floor).moving)
    if (!moving) throw new Error('the placeholder course has a moving floor')
    const f = moving.get(Transform2D)
    place(0, { x: f.x, y: f.y + tuning.floorHeight / 2 + tuning.racerHeight / 2 }, LEAVING)
    const floorBefore = moving.get(Floor).x
    const racerBefore = pos(0).x
    run(1)
    const shift = moving.get(Floor).x - floorBefore
    expect(shift).not.toBe(0)
    expect(pos(0).x - racerBefore).toBeCloseTo(shift, 4)
  })

  it('lets a held fast fall win over a landing bounce, pinning the racer to the floor', async () => {
    await startRace()
    run(1, [input(0, { fastFall: true })])
    run(30)
    expect(vel(0).vy).toBe(Math.fround(tuning.fastFallVelocity))
    expect(pos(0).y).toBeCloseTo(SPAWN_Y, 1)
  })

  it('wraps a racer that leaves one side into the other', async () => {
    await startRace()
    place(0, { x: tuning.viewportWidth / 2 - 0.01, y: 30 }, { vx: tuning.moveSpeed })
    run(1, [input(0, { right: true })])
    expect(pos(0).x).toBeLessThan(0)
    expect(pos(0).x).toBeGreaterThan(-tuning.viewportWidth / 2)
  })

  it('respawns a racer who falls below the death line, keeping the lap', async () => {
    await startRace()
    place(0, { x: 0, y: -tuning.deathLineMargin - 0.5 }, LEAVING)
    const events = raceEvents(run(1))
    expect(events).toEqual([{ type: 'race.racer-reset', payload: { seat: 0, reason: 'fall' } }])
    expect(pos(0)).toMatchObject({ x: 0, y: SPAWN_Y })
    expect(vel(0).vy).toBeCloseTo(tuning.bounceVelocity, 5)
    expect(racer(0).get(Racer).visited).toBe('10000000')
  })

  it('takes race.reset as one respawn, not one per tick', async () => {
    await startRace()
    place(0, { x: 3, y: 12 })
    const events = raceEvents(run(5, [command(0, RaceReset.id, {})]))
    expect(events).toEqual([{ type: 'race.racer-reset', payload: { seat: 0, reason: 'manual' } }])
  })

  it('ignores a command from a seat that has no racer', async () => {
    await startRace([0, 1])
    run(1, [input(3, { right: true })])
    expect(pos(0).y).toBe(SPAWN_Y)
  })
})

describe('laps and the finish', () => {
  /** Lands seat `seat` on floor 1 with every other floor of the ascent already credited. */
  function completeAscent(seat: number): SimEvent[] {
    const f = floor(1).get(Transform2D)
    place(seat, { x: f.x, y: f.y + 1.2 }, LEAVING)
    racer(seat).set(Racer, { visited: '10111111' })
    const events: SimEvent[] = []
    for (let i = 0; i < 60 && !events.some((e) => e.type !== 'race.floor-landed'); i++)
      events.push(...raceEvents(run(1)))
    return events
  }

  it('completes a lap: respawns the racer at the start and holds them for lapHoldTicks', async () => {
    await startRace()
    expect(completeAscent(0)).toEqual([
      { type: 'race.floor-landed', payload: { seat: 0, floor: 1 } },
      { type: 'race.lap-completed', payload: { seat: 0, lap: 1 } },
    ])
    expect(racer(0).get(Racer)).toMatchObject({ lap: 2, visited: '10000000' })
    expect(pos(0)).toMatchObject({ x: 0, y: SPAWN_Y })
    run(tuning.lapHoldTicks - 1)
    expect(pos(0)).toMatchObject({ x: 0, y: SPAWN_Y })
    run(2)
    expect(pos(0).y).toBeGreaterThan(SPAWN_Y)
  })

  it('finishes the race on the last lap: standings, a winner, and nothing moves after', async () => {
    await startRace()
    completeAscent(0)
    run(tuning.lapHoldTicks + 1)
    const events = completeAscent(0)
    expect(events.at(-1)).toEqual({ type: 'race.finished', payload: { winner: 0 } })
    const race = sim.resource(Race)
    expect(race).toMatchObject({ phase: 'finished', standings: [0], winner: 0 })
    expect(racer(0).get(Racer).finishedAt).toBe(sim.tick - 1)
    run(1, [input(1, { right: true })])
    const frozen = sim.query(Racer).map((e) => e.get(Transform2D))
    run(30, [input(1, { left: true })])
    expect(sim.query(Racer).map((e) => e.get(Transform2D))).toEqual(frozen)
  })
})

// The scripted four-player race for the golden (PRODUCT.8b acceptance): four seats driven the way a client drives a
// seat, by sending `race.input` only when the held input changes, plus one `race.reset`. Each seat steers by a small
// rule that reads the sim between steps (as a client reads its snapshot): climb to the lowest floor not yet credited,
// riding its side when below it and landing on it from above. The seats differ in when they start, how close they
// steer and when they fast-fall, so they spread out and one wins.
import { Transform2D } from '@mcthaydt/automata-physics/2d'
import { type Command, canonicalJson, createSim, type EntityRef, type Sim } from '@mcthaydt/automata-sim'
import { hex64, utf8, xxhash64 } from '@mcthaydt/automata-sim/hash'
import { PLACEHOLDER_COURSE_SEED, PLACEHOLDER_TUNING } from '../content/placeholder.content'
import { Floor, Race, RaceInput, RaceReset, Racer, RaceStart, racePlugins } from '../sim/index'

const ROOM_SOURCE = 255
const SEATS = [0, 1, 2, 3] as const
/** The tick each seat sends its first input. */
const FIRST_INPUT = [1, 4, 9, 15]
/** How far from a floor's centre each seat stops steering, in metres. */
const DEAD_ZONE = [0.1, 0.3, 0.5, 0.2]
/** Seat 2 holds a fast fall for a few ticks every 300; seat 3 sends one reset. */
const FAST_FALL_EVERY = 300
const FAST_FALL_TICKS = 6
const RESET = { seat: 3, tick: 500 }
/** A race that has not finished by then is a failed script, not a golden. */
const MAX_TICKS = 12_000

interface Held {
  left: boolean
  right: boolean
  fastFall: boolean
}

export interface RaceRun {
  readonly ticks: number
  readonly hash: string
  readonly events: string
  readonly eventCount: number
  readonly standings: readonly number[]
  readonly winner: number
}

function steer(sim: Sim, racer: EntityRef, seat: number, tick: number): Held {
  const tuning = PLACEHOLDER_TUNING
  const rules = racer.get(Racer)
  const target = rules.visited.indexOf('0')
  const floor = sim.query(Floor).find((f) => f.get(Floor).index === target)
  const fastFall = seat === 2 && tick % FAST_FALL_EVERY < FAST_FALL_TICKS && tick > FAST_FALL_EVERY
  if (!floor) return { left: false, right: false, fastFall }
  const at = racer.get(Transform2D)
  const to = floor.get(Transform2D)
  // The shorter way round the wrap.
  const width = tuning.viewportWidth
  let dx = to.x - at.x
  if (dx > width / 2) dx -= width
  if (dx < -width / 2) dx += width
  const besideDistance = (tuning.floorWidth + tuning.racerWidth) / 2
  const below = at.y - tuning.racerHeight / 2 < to.y + tuning.floorHeight / 2
  let direction = 0
  // Under the floor: move out from beneath it (its underside would hold the racer), then press into its side to ride.
  if (below && Math.abs(dx) < besideDistance - 0.05) direction = dx > 0 ? -1 : 1
  else if (Math.abs(dx) > (DEAD_ZONE[seat] ?? 0)) direction = dx > 0 ? 1 : -1
  return { left: direction < 0, right: direction > 0, fastFall }
}

function sameHeld(a: Held | undefined, b: Held): boolean {
  return a !== undefined && a.left === b.left && a.right === b.right && a.fastFall === b.fastFall
}

/** The commands for this tick: the start, then each seat's changed input and the scripted reset. */
function commandsFor(sim: Sim, lastHeld: Map<number, Held>, seq: { next: number }): Command[] {
  const tick = sim.tick
  const out: Command[] = []
  const add = (source: number, type: string, payload: unknown) =>
    out.push({ tick, source, seq: seq.next++, type, payload })
  if (tick === 0) {
    add(ROOM_SOURCE, RaceStart.id, { courseSeed: PLACEHOLDER_COURSE_SEED, seats: [...SEATS] })
    return out
  }
  for (const racer of sim.query(Racer)) {
    const seat = racer.get(Racer).seat
    if (tick < (FIRST_INPUT[seat] ?? 0)) continue
    const held = steer(sim, racer, seat, tick)
    if (!sameHeld(lastHeld.get(seat), held)) {
      add(seat, RaceInput.id, held)
      lastHeld.set(seat, held)
    }
    if (seat === RESET.seat && tick === RESET.tick) add(seat, RaceReset.id, {})
  }
  return out
}

async function createRaceSim(): Promise<Sim> {
  return createSim({ seed: 2026, plugins: racePlugins(PLACEHOLDER_TUNING) })
}

/**
 * Runs the scripted race to its finish and hashes it: the sim's hash at the end, and a hash of every event. With
 * `restoreAt`, the sim is snapshotted at that tick and the race continues in a fresh sim restored from the bytes,
 * which must reach the same result.
 */
export async function runScriptedRace(restoreAt?: number): Promise<RaceRun> {
  let sim = await createRaceSim()
  // Per-seat seq and held input, as each client would keep them; seq is one counter per run (unique per source).
  const lastHeld = new Map<number, Held>()
  const seq = { next: 0 }
  const lines: string[] = []
  while (sim.resource(Race).phase !== 'finished') {
    if (sim.tick >= MAX_TICKS) throw new Error(`the scripted race did not finish in ${MAX_TICKS} ticks`)
    if (sim.tick === restoreAt) {
      const bytes = sim.snapshot()
      sim.dispose()
      sim = await createRaceSim()
      sim.restore(bytes)
    }
    const result = sim.step(commandsFor(sim, lastHeld, seq))
    if (result.rejected.length > 0) throw new Error(`rejected: ${canonicalJson(result.rejected)}`)
    for (const event of result.events) lines.push(canonicalJson(event))
  }
  const race = sim.resource(Race)
  const run: RaceRun = {
    ticks: sim.tick,
    hash: sim.hash(),
    events: hex64(xxhash64(utf8(lines.join('\n')))),
    eventCount: lines.length,
    standings: [...race.standings],
    winner: race.winner,
  }
  sim.dispose()
  return run
}

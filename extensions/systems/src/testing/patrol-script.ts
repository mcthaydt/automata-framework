// The systems golden (M6 spec §4.9, SY-a): the toy watchman patrols the clinic’s corridor (end ↔ cmid), hears a bottle
// at step 20 (and gives up after 3 s there), the closet door opens at 200, and from step 380 the player walks from the hall up into the corridor,
// into his sight. 600 steps, straight or restored from a snapshot; the step of his patrol → hunt switch is reported.
import { canonicalJson, type Sim } from '@mcthaydt/automata-sim'
import { hex64, utf8, xxhash64 } from '@mcthaydt/automata-sim/hash'
import { sceneOf, watchman } from './toy'
import { createWardGame, fact, load, move, noise, type Order, stepWith } from './ward-game'

const TICKS = 600

function ordersAt(tick: number): Order[] {
  if (tick === 0) return [load({ watchman: { x: 0, z: -6.1 } }), move(0, 4.8), fact('power', false)]
  if (tick === 20) return [noise(0, -2.2, 9)]
  if (tick === 200) return [{ type: 'nav.door', payload: { door: 'closetDoor', open: true } }]
  if (tick >= 380) {
    // 1.5 m/s from the hall's south end up the corridor.
    const z = Math.max(-3, 0.3 - ((tick - 380) * 1.5) / 60)
    return [move(0, z)]
  }
  return []
}

export interface GoldenRun {
  readonly seed: number
  readonly ticks: number
  readonly hash: string
  readonly events: string
  readonly eventCount: number
  /** The step whose events hold the watchman's patrol → hunt switch (SY-a). */
  readonly hunts: number
}

export async function runSystemsGolden(restoreAt?: number): Promise<GoldenRun> {
  const create = async (): Promise<Sim> => (await createWardGame(sceneOf(watchman()), {}, ['shriek'])).sim
  let sim = await create()
  const lines: string[] = []
  let hunts = -1
  while (sim.tick < TICKS) {
    if (sim.tick === restoreAt) {
      const bytes = sim.snapshot()
      sim.dispose()
      sim = await create()
      sim.restore(bytes)
    }
    const tick = sim.tick
    for (const e of stepWith(sim, ordersAt(tick)).events) {
      lines.push(canonicalJson(e))
      const p = e.payload as { from?: string; to?: string }
      if (hunts < 0 && e.type === 'systems.mode' && p.from === 'patrol' && p.to === 'hunt') hunts = tick
    }
  }
  const run = {
    seed: sim.seed,
    ticks: sim.tick,
    hash: sim.hash(),
    events: hex64(xxhash64(utf8(lines.join('\n')))),
    eventCount: lines.length,
    hunts,
  }
  sim.dispose()
  return run
}

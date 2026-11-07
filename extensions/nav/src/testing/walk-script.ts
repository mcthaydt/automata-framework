// The nav golden: the clinic with three walkers for 600 steps, straight or restored from a snapshot.
// Walker 1 crosses the ward into the corridor and back; walker 2 tries the supply room while its door is shut
// (unreachable), the door opens at step 200, and it tries again at 210; walker 3 walks to three nodes in turn, the
// second one given mid-walk.
import { canonicalJson, type Sim } from '@automata/sim'
import { hex64, utf8, xxhash64 } from '@automata/sim/hash'
import { createWalkGame, door, load, type Order, spawnWalker, stepWith, walkTo } from './walk-game'

const TICKS = 600

function ordersAt(tick: number, [one, two, three]: readonly number[]): Order[] {
  const a = one as number
  const b = two as number
  const c = three as number
  switch (tick) {
    case 0:
      return [load()]
    case 1:
      return [walkTo(a, 0, -5), walkTo(b, 3, -4), walkTo(c, 3.95, 3.95)]
    case 200:
      return [door('closetDoor', true)]
    case 210:
      return [walkTo(b, 3, -4)]
    case 260:
      return [walkTo(c, -3.2, -2.2)]
    case 460:
      return [walkTo(a, -3, 3)]
    case 480:
      return [walkTo(c, -4.2, 2.75)]
    default:
      return []
  }
}

export interface GoldenRun {
  readonly seed: number
  readonly ticks: number
  readonly hash: string
  readonly events: string
  readonly eventCount: number
}

export async function runNavGolden(restoreAt?: number): Promise<GoldenRun> {
  let sim: Sim = await createWalkGame()
  const walkers = [
    spawnWalker(sim, -3, 3, 2),
    spawnWalker(sim, 0.3, -4, 1.1),
    spawnWalker(sim, -1.6, 2.1, 1.7),
  ]
  const lines: string[] = []
  while (sim.tick < TICKS) {
    if (sim.tick === restoreAt) {
      const bytes = sim.snapshot()
      sim.dispose()
      sim = await createWalkGame()
      sim.restore(bytes)
    }
    for (const e of stepWith(sim, ordersAt(sim.tick, walkers)).events) lines.push(canonicalJson(e))
  }
  const run = {
    seed: sim.seed,
    ticks: sim.tick,
    hash: sim.hash(),
    events: hex64(xxhash64(utf8(lines.join('\n')))),
    eventCount: lines.length,
  }
  sim.dispose()
  return run
}

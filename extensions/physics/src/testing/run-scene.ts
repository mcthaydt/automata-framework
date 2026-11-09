// Runs a scene for the snapshot and parity tests: the straight run and a run restored mid-way, each giving
// the sim hash and a hash of every event, so a divergence in either state or events is caught.
import { type Command, canonicalJson, type Sim } from '@automata/sim'
import { hex64, utf8, xxhash64 } from '@automata/sim/hash'

export interface SceneRun {
  readonly seed: number
  /** The sim's tick at the end: scenes start from a fresh sim at tick 0, so this is the ticks stepped. */
  readonly ticks: number
  readonly hash: string
  readonly events: string
  readonly eventCount: number
}

export async function runScene(
  create: () => Promise<Sim>,
  commands: (tick: number) => Command[],
  ticks: number,
  restoreAt?: number,
): Promise<SceneRun> {
  let sim = await create()
  const lines: string[] = []
  while (sim.tick < ticks) {
    if (sim.tick === restoreAt) {
      const bytes = sim.snapshot()
      sim.dispose()
      sim = await create()
      sim.restore(bytes)
    }
    for (const e of sim.step(commands(sim.tick)).events) lines.push(canonicalJson(e))
  }
  const out = {
    seed: sim.seed,
    ticks: sim.tick,
    hash: sim.hash(),
    events: hex64(xxhash64(utf8(lines.join('\n')))),
    eventCount: lines.length,
  }
  sim.dispose()
  return out
}

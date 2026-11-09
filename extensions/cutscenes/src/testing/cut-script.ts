// The cutscenes golden: the clinic's eight converted scripts, a script that waits on a resolvable
// anchor and one on an anchor the scene lacks, played by a fixed script for 600 steps: cutscenes started in turn, gameplay
// input sent throughout (ignored while one plays), skips now and then, straight or restored from a snapshot.
import { canonicalJson, type Sim } from '@automata/sim'
import { hex64, utf8, xxhash64 } from '@automata/sim/hash'
import { parse } from 'smol-toml'
import type { CutsceneScript } from '../shared/sim/cutscene.schema'
import { createCutGame, hit, hits, load, type Order, play, skip, step } from './cut-game'
import clinicToml from './fixtures/clinic.cutscenes.toml?raw'

const anchored = (id: string, at: string): CutsceneScript => ({
  id,
  duration: 2,
  camera: [{ t: 0, pos: [0, 1.6, 4], look: [0, 1.2, 0] }],
  actor: [{ who: 'nurse', t: 0, at }],
})
const SCRIPTS: CutsceneScript[] = [
  ...(parse(clinicToml) as unknown as { cutscenes: CutsceneScript[] }).cutscenes,
  anchored('meet', 'player'),
  anchored('ghost', 'actor:nurse'),
]
const IDS = SCRIPTS.map((s) => s.id)
const TICKS = 600

function ordersAt(tick: number): Order[] {
  if (tick === 0) return [load()]
  const orders: Order[] = []
  if (tick % 53 === 1) orders.push(play(IDS[Math.floor(tick / 53) % IDS.length] as string))
  if (tick % 5 === 0) orders.push(hit())
  if (tick % 131 === 0) orders.push(skip())
  return orders
}

export interface GoldenRun {
  readonly seed: number
  readonly ticks: number
  readonly hash: string
  readonly events: string
  readonly eventCount: number
  readonly started: number
  readonly ended: number
  readonly hits: number
}

export async function runCutsceneGolden(restoreAt?: number): Promise<GoldenRun> {
  const options = {
    anchor: (_ctx: unknown, name: string) => (name === 'player' ? { x: 0, z: 0 } : undefined),
  }
  let sim: Sim = (await createCutGame(SCRIPTS, options)).sim
  const lines: string[] = []
  let started = 0
  let ended = 0
  while (sim.tick < TICKS) {
    if (sim.tick === restoreAt) {
      const bytes = sim.snapshot()
      sim.dispose()
      sim = (await createCutGame(SCRIPTS, options)).sim
      sim.restore(bytes)
    }
    for (const e of step(sim, ...ordersAt(sim.tick)).events) {
      lines.push(canonicalJson(e))
      if (e.type === 'cutscene.started') started += 1
      if (e.type === 'cutscene.ended') ended += 1
    }
  }
  const run = {
    seed: sim.seed,
    ticks: sim.tick,
    hash: sim.hash(),
    events: hex64(xxhash64(utf8(lines.join('\n')))),
    eventCount: lines.length,
    started,
    ended,
    hits: hits(sim),
  }
  sim.dispose()
  return run
}

// The puzzle golden (M6 spec §4.9): the clinic's converted content, played by a fixed script of verbs for 600 steps
// (hotspots in turn, with and without a carried item, combines and codes), straight or restored from a snapshot.
// Every call the clinic names is declared and sets a fact, so calls change the state the hash covers.
import { canonicalJson, createSim, defineCommand, definePlugin, defineSystem, type Sim } from '@automata/sim'
import { hex64, utf8, xxhash64 } from '@automata/sim/hash'
import { parse } from 'smol-toml'
import { z } from 'zod'
import { createPuzzlePlugin, loadPuzzle, type PuzzleDef, PuzzleState } from '../sim/index'
import clinicToml from './fixtures/clinic.puzzle.toml?raw'

const clinic = parse(clinicToml) as unknown as PuzzleDef
const calls = [
  ...new Set(clinic.actions.flatMap((a) => a.then.flatMap((e) => ('call' in e ? [e.call] : [])))),
].sort()
const hotspots = Object.keys(clinic.hotspots).sort()
const TICKS = 600

const Load = defineCommand('golden.load', z.strictObject({}))
const loader = definePlugin({
  name: 'golden',
  dependsOn: ['puzzle'],
  commands: [Load],
  systems: [
    defineSystem({
      name: 'golden.load',
      phase: 'input',
      run: (ctx) => {
        if (ctx.commands.of(Load).length > 0) loadPuzzle(ctx, clinic)
      },
    }),
  ],
})

const create = (): Promise<Sim> =>
  createSim({
    seed: 2026,
    plugins: [
      createPuzzlePlugin({
        calls: Object.fromEntries(
          calls.map((name) => [
            name,
            (ctx) => {
              ctx.resource(PuzzleState).facts[`called.${name}`] = ctx.tick
            },
          ]),
        ),
      }),
      loader,
    ],
  })

/** The verb for a tick: the script cycles hotspots, items, pairs and codes in a fixed order. */
function verbAt(sim: Sim, tick: number): { type: string; payload: unknown } {
  if (tick === 0) return { type: 'golden.load', payload: {} }
  const items = sim.resource(PuzzleState).items
  const item = items.length > 0 ? items[tick % items.length] : undefined
  if (tick % 11 === 0)
    return { type: 'puzzle.verb', payload: { at: 'code', code: String(tick % 10_000).padStart(4, '0') } }
  if (tick % 7 === 0 && items.length > 1)
    return {
      type: 'puzzle.verb',
      payload: { at: 'combine', pair: [items[0], items[(tick >> 3) % items.length]] },
    }
  const at = hotspots[(tick * 5) % hotspots.length] as string
  return { type: 'puzzle.verb', payload: tick % 2 === 0 && item ? { at, held: item } : { at } }
}

export interface GoldenRun {
  readonly seed: number
  readonly ticks: number
  readonly hash: string
  readonly events: string
  readonly eventCount: number
}

export async function runPuzzleGolden(restoreAt?: number): Promise<GoldenRun> {
  let sim = await create()
  const lines: string[] = []
  while (sim.tick < TICKS) {
    if (sim.tick === restoreAt) {
      const bytes = sim.snapshot()
      sim.dispose()
      sim = await create()
      sim.restore(bytes)
    }
    const { type, payload } = verbAt(sim, sim.tick)
    for (const e of sim.step([{ tick: sim.tick, source: 0, seq: 0, type, payload }]).events)
      lines.push(canonicalJson(e))
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

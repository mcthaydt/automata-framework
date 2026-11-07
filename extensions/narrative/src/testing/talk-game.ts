// A test game for narrative on the clinic's floor plan (sectors' fixture): it loads a scene's puzzle and narrative by
// command, moves the player, sets facts and fires system events. Puzzle's `dialogue` and `verb` hooks go to narrative
// (NR-D3); the player is an entity with `InSector`, named in `narrative.env` (NR-D5).
import { createPuzzlePlugin, loadPuzzle, type PuzzleDef, PuzzleState } from '@automata/puzzle/sim'
import { InSector, loadSectorMap, type SectorMap, sectorsPlugin } from '@automata/sectors/sim'
import clinicMapToml from '@automata/sectors/testing/fixtures/clinic.sector-map.toml?raw'
import {
  type Command,
  createSim,
  defineCommand,
  definePlugin,
  defineSystem,
  type Sim,
  type StepResult,
} from '@automata/sim'
import { parse } from 'smol-toml'
import { z } from 'zod'
import { createNarrative, type NarrativeOptions, type NarrativeScene } from '../sim/index'

const point = z.strictObject({ x: z.number(), z: z.number() })
const Load = defineCommand('talk.load', z.strictObject({}))
const Move = defineCommand('talk.move', point)
const Fact = defineCommand(
  'talk.fact',
  z.strictObject({ name: z.string(), value: z.union([z.boolean(), z.number(), z.string()]) }),
)
const System = defineCommand('talk.system', z.strictObject({ event: z.string() }))

/** Plan points in the clinic: the hall and the ward (zone `hall`), the corridor and the closet. */
export const SPOTS = {
  hall: { x: 0, z: 3 },
  ward: { x: -3, z: -2 },
  corridor: { x: 0, z: -5 },
  closet: { x: 3, z: -5 },
} as const

export interface TalkGame {
  readonly sim: Sim
  readonly player: number
}

export async function createTalkGame(
  puzzle: PuzzleDef,
  scene: NarrativeScene,
  options: NarrativeOptions = {},
): Promise<TalkGame> {
  const narrative = createNarrative(options)
  const game = definePlugin({
    name: 'talk',
    dependsOn: ['sectors', 'puzzle', 'narrative'],
    commands: [Load, Move, Fact, System],
    systems: [
      defineSystem('talk.drive', 'input', (ctx) => {
        for (const _ of ctx.commands.of(Load)) {
          loadSectorMap(ctx, parse(clinicMapToml) as unknown as SectorMap)
          loadPuzzle(ctx, puzzle)
          narrative.load(ctx, scene)
        }
        const { player } = ctx.resource(narrative.env)
        for (const { payload } of ctx.commands.of(Move))
          if (player !== null) ctx.entity(player)?.set(InSector, payload)
        for (const { payload } of ctx.commands.of(Fact))
          ctx.resource(PuzzleState).facts[payload.name] = payload.value
        for (const { payload } of ctx.commands.of(System)) narrative.fireSystem(ctx, payload.event)
      }),
    ],
  })
  const sim = await createSim({
    seed: 2026,
    plugins: [
      sectorsPlugin,
      createPuzzlePlugin({ dialogue: narrative.startDialogue, verb: narrative.heardVerb }),
      narrative.plugin,
      game,
    ],
  })
  const player = sim.spawn([[InSector, SPOTS.hall]])
  sim.resource(narrative.env).player = player
  return { sim, player }
}

export type Order = Pick<Command, 'type' | 'payload'>
export const load = (): Order => ({ type: 'talk.load', payload: {} })
export const move = (at: { x: number; z: number }): Order => ({ type: 'talk.move', payload: at })
export const fact = (name: string, value: boolean | number | string): Order => ({
  type: 'talk.fact',
  payload: { name, value },
})
export const system = (event: string): Order => ({ type: 'talk.system', payload: { event } })
export const verb = (at: string, held?: string): Order => ({
  type: 'puzzle.verb',
  payload: held === undefined ? { at } : { at, held },
})
export const start = (graph: string): Order => ({ type: 'narrative.start', payload: { graph } })
export const advance = (): Order => ({ type: 'narrative.advance', payload: {} })
export const choose = (index: number): Order => ({ type: 'narrative.choose', payload: { index } })

/** Steps once with `orders`. */
export const step = (sim: Sim, ...orders: Order[]): StepResult =>
  sim.step(orders.map((o, seq) => ({ tick: sim.tick, source: 0, seq, ...o })))
/** The narrative and puzzle events of a step as `type payload` pairs. */
export const heard = (result: StepResult): unknown[] =>
  result.events.filter((e) => /^(narrative|puzzle)\./.test(e.type)).map((e) => [e.type, e.payload])

// A test game for cutscenes (M6.9a): it loads scripts by command, starts one by command, and counts the steps in which its
// own input command was applied. `hit` stands for gameplay input; it is ignored while a cutscene holds `locked`.
import {
  type Command,
  createSim,
  defineCommand,
  definePlugin,
  defineResource,
  defineSystem,
  type Sim,
  type StepResult,
} from '@automata/sim'
import { z } from 'zod'
import { type Cutscenes, type CutscenesOptions, createCutscenes } from '../sim/cutscene.plugin'
import type { CutsceneScript } from '../sim/cutscene.schema'

const Load = defineCommand('cut.load', z.strictObject({}))
const Play = defineCommand('cut.play', z.strictObject({ id: z.string() }))
const Hit = defineCommand('cut.hit', z.strictObject({}))
const Hits = defineResource('cut.hits', z.strictObject({ n: z.number().int() }), () => ({ n: 0 }))

export interface CutGame {
  readonly sim: Sim
  readonly cutscenes: Cutscenes
}

export async function createCutGame(
  scripts: readonly CutsceneScript[],
  options: CutscenesOptions = {},
): Promise<CutGame> {
  const cutscenes = createCutscenes(options)
  const game = definePlugin({
    name: 'cut',
    resources: [Hits],
    commands: [Load, Play, Hit],
    systems: [
      defineSystem('cut.drive', 'gameplay', (ctx) => {
        for (const _ of ctx.commands.of(Load)) cutscenes.load(ctx, scripts)
        for (const { payload } of ctx.commands.of(Play)) cutscenes.start(ctx, payload.id)
        for (const _ of ctx.commands.of(Hit)) if (!cutscenes.locked(ctx)) ctx.resource(Hits).n += 1
      }),
    ],
  })
  const sim = await createSim({ seed: 2026, plugins: [cutscenes.plugin, game] })
  return { sim, cutscenes }
}

export type Order = Pick<Command, 'type' | 'payload'>
export const load = (): Order => ({ type: 'cut.load', payload: {} })
export const play = (id: string): Order => ({ type: 'cut.play', payload: { id } })
export const hit = (): Order => ({ type: 'cut.hit', payload: {} })
export const skip = (): Order => ({ type: 'cutscene.skip', payload: {} })
export const hits = (sim: Sim): number => sim.resource(Hits).n

/** Steps once with `orders`. */
export const step = (sim: Sim, ...orders: Order[]): StepResult =>
  sim.step(orders.map((o, seq) => ({ tick: sim.tick, source: 0, seq, ...o })))
/** The cutscene events of a step as `type payload` pairs. */
export const heard = (result: StepResult): [string, unknown][] =>
  result.events.filter((e) => e.type.startsWith('cutscene.')).map((e) => [e.type, e.payload])

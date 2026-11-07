// A test game for systems on the clinic (nav's fixture: sectors' map, the nav graph and the clinic's boxes): it loads
// a def by command, moves the player, sets facts and makes noises. The player is an entity with `InSector`, named in
// `systems.env`. Hooks log what they were called with.
import { createNavPlugin, loadNavGraph, NavAgent } from '@automata/nav/sim'
import { clinicBlocked, clinicGraph, clinicMap } from '@automata/nav/testing/clinic'
import { createPuzzlePlugin, loadPuzzle, type PuzzleDef, PuzzleState, type Value } from '@automata/puzzle/sim'
import { InSector, loadSectorMap, type Point, resolvedMap, sectorsPlugin } from '@automata/sectors/sim'
import {
  type Command,
  createSim,
  defineCommand,
  definePlugin,
  defineSystem,
  type PluginDef,
  type Sim,
  type SimEvent,
  type StepResult,
} from '@automata/sim'
import { z } from 'zod'
import { createSystems } from '../shared/sim/systems.plugin'
import { type AgentRecord, SystemsEnv, SystemsState } from '../shared/sim/systems.resource'
import type { SystemsDef } from '../shared/sim/systems.schema'
import type { SystemsOptions } from '../shared/sim/world'

const point = z.strictObject({ x: z.number(), z: z.number() })
const Load = defineCommand('ward.load', z.strictObject({ places: z.record(z.string(), point) }))
const Move = defineCommand('ward.move', point)
const Fact = defineCommand(
  'ward.fact',
  z.strictObject({ name: z.string(), value: z.union([z.boolean(), z.number(), z.string()]) }),
)
const Items = defineCommand('ward.items', z.strictObject({ items: z.array(z.string()) }))
const MakeNoise = defineCommand(
  'ward.noise',
  z.strictObject({ at: point, loudness: z.number(), kind: z.string() }),
)

export interface WardGame {
  readonly sim: Sim
  readonly player: number
  /** Hook calls, in order: `<hook>:<agent or world>:<mode>`. */
  readonly log: string[]
}

/** What a bot's run adds (none of it is there by default, so the golden's sim is unchanged). */
export interface WardExtras {
  /** A puzzle loaded with the scene, and the `ward.items` command that sets the items carried. */
  readonly puzzle?: PuzzleDef
  /** The player walks with nav (`nav.agent`, at `speed` m/s) instead of only being moved. */
  readonly walker?: number
  /** More plugins (a run's watcher). */
  readonly plugins?: readonly PluginDef[]
}

export async function createWardGame(
  def: SystemsDef,
  options: SystemsOptions = {},
  hookNames: readonly string[] = [],
  extras: WardExtras = {},
): Promise<WardGame> {
  const log: string[] = []
  const hooks: Record<string, NonNullable<SystemsOptions['hooks']>[string]> = {}
  for (const name of hookNames)
    hooks[name] = (w, agent) => {
      log.push(`hook:${name}:${agent === null ? 'world' : w.state.agents[agent]?.mode}`)
    }
  const systems = createSystems({
    blocked: (ctx, doors) => clinicBlocked(resolvedMap(ctx), doors),
    sight: (ctx, doors) => clinicBlocked(resolvedMap(ctx), doors, { furniture: false }),
    ...options,
    hooks: { ...hooks, ...options.hooks },
  })
  const game = definePlugin({
    name: 'ward',
    dependsOn: ['sectors', 'nav', 'puzzle', 'systems'],
    commands:
      extras.puzzle === undefined ? [Load, Move, Fact, MakeNoise] : [Load, Move, Fact, MakeNoise, Items],
    systems: [
      defineSystem('ward.drive', 'input', (ctx) => {
        for (const { payload } of ctx.commands.of(Load)) {
          loadSectorMap(ctx, clinicMap())
          loadNavGraph(ctx, clinicGraph())
          systems.load(ctx, def, payload.places)
          if (extras.puzzle !== undefined) loadPuzzle(ctx, extras.puzzle)
        }
        if (extras.puzzle !== undefined)
          for (const { payload } of ctx.commands.of(Items))
            ctx.resource(PuzzleState).items = [...payload.items].sort()
        const player = ctx.resource(SystemsEnv).player
        for (const { payload } of ctx.commands.of(Move)) ctx.entity(player)?.set(InSector, payload)
        for (const { payload } of ctx.commands.of(Fact))
          ctx.resource(PuzzleState).facts[payload.name] = payload.value
        for (const { payload } of ctx.commands.of(MakeNoise)) systems.hear(ctx, payload)
      }),
    ],
  })
  const sim = await createSim({
    seed: 2026,
    plugins: [
      sectorsPlugin,
      createNavPlugin({ blocked: (ctx, doors) => clinicBlocked(resolvedMap(ctx), doors) }),
      // Puzzle's noises are heard by the systems on the verb's step.
      createPuzzlePlugin({
        noise: systems.hear,
        ...(options.facts === undefined ? {} : { facts: options.facts }),
      }),
      systems.plugin,
      game,
      ...(extras.plugins ?? []),
    ],
  })
  const player =
    extras.walker === undefined
      ? sim.spawn([[InSector, { x: 3, z: 5 }]])
      : sim.spawn([
          [InSector, { x: 3, z: 5 }],
          [NavAgent, { speed: extras.walker }],
        ])
  sim.resource(SystemsEnv).player = player
  return { sim, player, log }
}

export type Order = Pick<Command, 'type' | 'payload'>
export const load = (places: Readonly<Record<string, Point>> = {}): Order => ({
  type: 'ward.load',
  payload: { places },
})
export const move = (x: number, z: number): Order => ({ type: 'ward.move', payload: { x, z } })
export const fact = (name: string, value: Value): Order => ({ type: 'ward.fact', payload: { name, value } })
export const noise = (x: number, z: number, loudness: number, kind = 'bottle'): Order => ({
  type: 'ward.noise',
  payload: { at: { x, z }, loudness, kind },
})

export const stepWith = (sim: Sim, orders: readonly Order[] = []): StepResult =>
  sim.step(orders.map((order, seq) => ({ tick: sim.tick, source: 0, seq, ...order })))

/** Steps for `seconds` (at the sim's rate), the first step with `orders`; gives every event. */
export function run(sim: Sim, seconds: number, orders: readonly Order[] = []): SimEvent[] {
  const events: SimEvent[] = []
  const steps = Math.round(seconds * sim.tickHz)
  for (let i = 0; i < steps; i++) events.push(...stepWith(sim, i === 0 ? orders : []).events)
  return events
}

export const agent = (sim: Sim, id: string): AgentRecord =>
  sim.resource(SystemsState).agents[id] as AgentRecord
export const agentAt = (sim: Sim, id: string): Point => {
  const { x, z } = (sim.entity(agent(sim, id).sid) as NonNullable<ReturnType<Sim['entity']>>).get(InSector)
  return { x, z }
}
export const place = (sim: Sim, id: string, at: Point): void => {
  sim.entity(agent(sim, id).sid)?.set(InSector, { x: at.x, z: at.z })
}
export const kinds = (events: readonly SimEvent[], type: string): unknown[] =>
  events.filter((e) => e.type === type).map((e) => e.payload)
export const items = (list: readonly string[]): Order => ({
  type: 'ward.items',
  payload: { items: [...list] },
})

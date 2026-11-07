/**
 * The room tests' game: each seat gets an avatar that walks along a line, and the first to reach the content's goal
 * wins. Small enough to read in one go, and enough to show every rule the room applies: spawn commands from
 * `ServerGameDef.seat`, client commands with a payload schema, a bot policy, and `ended` from an event.
 */

import { NetOwner, netPlugin } from '@automata/net/sim'
import {
  type CommandDef,
  type ComponentDef,
  createSim,
  defineCommand,
  defineComponent,
  defineEvent,
  definePlugin,
  defineSystem,
  type EventDef,
  type PluginDef,
  type Sim,
} from '@automata/sim'
import { z } from 'zod'
import { type BotPolicy, defineServer, type ServerDef, type ServerGameDef } from '../game/server-game'

export const Position: ComponentDef<{ x: 'i32' }> = defineComponent('position', { x: 'i32' })
type SeatPayload = z.ZodType<{ seat: number }>
type MovePayload = z.ZodType<{ dx: number }>

export const AvatarSpawn: CommandDef<SeatPayload> = defineCommand(
  'avatar.spawn',
  z.object({ seat: z.number().int() }).strict(),
)
export const Move: CommandDef<MovePayload> = defineCommand(
  'move',
  z.object({ dx: z.number().int().min(-1).max(1) }).strict(),
)
export const Won: EventDef<SeatPayload> = defineEvent(
  'game.won',
  z.object({ seat: z.number().int() }).strict(),
)

const goalOf = (content: unknown): number => (content as { goal: number }).goal

const avatars = defineSystem({
  name: 'avatars',
  phase: 'gameplay',
  run(ctx) {
    for (const spawn of ctx.commands.of(AvatarSpawn))
      ctx.spawn([NetOwner, { seat: spawn.payload.seat }], [Position, { x: 0 }])
    for (const move of ctx.commands.of(Move))
      for (const entity of ctx.query(NetOwner, Position))
        if (entity.get(NetOwner).seat === move.source)
          entity.set(Position, { x: entity.get(Position).x + move.payload.dx })
    for (const entity of ctx.query(NetOwner, Position))
      if (entity.get(Position).x >= goalOf(ctx.content)) ctx.emit(Won, { seat: entity.get(NetOwner).seat })
  },
})

export const walkPlugin: PluginDef = definePlugin({
  name: 'walk',
  components: [Position],
  commands: [AvatarSpawn, Move],
  events: [Won],
  systems: [avatars],
})

/** A bot that steps right two ticks in three, from its seeded stream. */
export const walkingBot: BotPolicy = {
  name: 'walker',
  commands: (_view, _seat, rng) => (rng.int(3) === 0 ? [] : [{ type: Move.id, payload: { dx: 1 } }]),
}

export const FIXTURE_CONTENT: { readonly goal: number } = { goal: 5 }

export const fixtureGame: ServerGameDef = {
  plugins: [netPlugin, walkPlugin],
  content: FIXTURE_CONTENT,
  seats: { min: 2, max: 2 },
  lobby: { countdownSeconds: 0.05, startWhen: 'all-ready' },
  seat: (seat) => [{ type: AvatarSpawn.id, payload: { seat } }],
  bots: walkingBot,
  ended: (_view, events) => events.some((event) => event.type === Won.id),
}

export function fixtureServer(over: Partial<ServerGameDef> = {}): ServerDef {
  return defineServer({ ...fixtureGame, ...over })
}

export function fixtureSim(seed: number): Promise<Sim> {
  return createSim({ seed, plugins: fixtureGame.plugins, content: FIXTURE_CONTENT })
}

/** Where each seat's avatar stands. */
export function positions(sim: { query: Sim['query'] }): Record<number, number> {
  const out: Record<number, number> = {}
  for (const entity of sim.query(NetOwner, Position)) out[entity.get(NetOwner).seat] = entity.get(Position).x
  return out
}

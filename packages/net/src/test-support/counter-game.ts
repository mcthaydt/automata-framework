/**
 * Net's own test game: a mover per seat on a line. `mover.spawn` seats one; `move` steps the sender's mover by its
 * `dx`. Small enough to read in one go, and every command's effect shows in the state, so a prediction that applied a
 * command on another tick hashes differently.
 */

import {
  type Command,
  type CommandDef,
  type ComponentDef,
  createSim,
  defineCommand,
  defineComponent,
  definePlugin,
  defineSystem,
  type PluginDef,
  type Sim,
} from '@mcthaydt/automata-sim'
import { z } from 'zod'

export const Mover: ComponentDef<{ seat: 'i32'; x: 'i32' }> = defineComponent('mover', {
  seat: 'i32',
  x: 'i32',
})
export const MoverSpawn: CommandDef<z.ZodType<{ seat: number }>> = defineCommand(
  'mover.spawn',
  z.object({ seat: z.number().int() }).strict(),
)
export const Move: CommandDef<z.ZodType<{ dx: number }>> = defineCommand(
  'move',
  z.object({ dx: z.number().int().min(-1).max(1) }).strict(),
)

const movers = defineSystem({
  name: 'movers',
  phase: 'gameplay',
  run(ctx) {
    for (const spawn of ctx.commands.of(MoverSpawn)) ctx.spawn([Mover, { seat: spawn.payload.seat, x: 0 }])
    for (const move of ctx.commands.of(Move))
      for (const entity of ctx.query(Mover))
        if (entity.get(Mover).seat === move.source)
          entity.set(Mover, { seat: move.source, x: entity.get(Mover).x + move.payload.dx })
  },
})

export const counterPlugin: PluginDef = definePlugin({
  name: 'counter',
  components: [Mover],
  commands: [MoverSpawn, Move],
  systems: [movers],
})

/** The room's source for its own commands: the highest the sim accepts, as the server's `ROOM_SOURCE`. */
export const ROOM = 255

export function counterSim(seed = 1): Promise<Sim> {
  return createSim({ seed, plugins: [counterPlugin] })
}

/** Where `seat`'s mover stands, or undefined without one. */
export function moverX(sim: Pick<Sim, 'query'>, seat: number): number | undefined {
  for (const entity of sim.query(Mover)) if (entity.get(Mover).seat === seat) return entity.get(Mover).x
  return undefined
}

/** A `move` from `seat`, stamped for `tick`. */
export const move = (seat: number, seq: number, tick: number, dx = 1): Command => ({
  tick,
  source: seat,
  seq,
  type: Move.id,
  payload: { dx },
})

/** The room's `mover.spawn` for `seat`, at `tick`. */
export const spawn = (seat: number, tick: number): Command => ({
  tick,
  source: ROOM,
  seq: seat,
  type: MoverSpawn.id,
  payload: { seat },
})

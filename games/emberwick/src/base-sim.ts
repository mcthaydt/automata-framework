// Sets up the base's sim: the room as content, the plugin, and the character at the room's start. Demos and
// games start from here (`@af-examples/base-2d`), then add their own plugins.
import { type Command, createSim, type PluginDef, type Sim } from '@mcthaydt/automata-sim'
import { parseRoom, ROOM, type RoomSource } from './content/room.ts'
import { base2dPlugin, type MoveInput, Player, PlayerControl } from './sim/index.ts'
import { HITBOX_H, SUB, TICK_HZ } from './sim/tuning.ts'

export interface BaseSimOptions {
  readonly seed?: number
  readonly room?: RoomSource
  /** Extra plugins a demo adds on top of the base. */
  readonly plugins?: readonly PluginDef[]
}

export async function createBaseSim(options: BaseSimOptions = {}): Promise<Sim> {
  const room = parseRoom(options.room ?? ROOM)
  const sim = await createSim({
    seed: options.seed ?? 1,
    tickHz: TICK_HZ,
    content: { room },
    plugins: [base2dPlugin, ...(options.plugins ?? [])],
  })
  // Standing on the tile below P: feet on that tile's top edge.
  const x = room.start.tx * room.tileSize * SUB
  const y = ((room.start.ty + 1) * room.tileSize - HITBOX_H) * SUB
  sim.spawn([[Player, { x, y, facing: 1 }], PlayerControl])
  return sim
}

/** This tick's `move` command from player slot 0. One per tick, so the tick doubles as the sequence number. */
export function moveCommand(sim: Sim, input: MoveInput): Command {
  return { tick: sim.tick, source: 0, seq: sim.tick, type: 'move', payload: input }
}

/** The character's current state. */
export function readPlayer(sim: Sim): Readonly<{
  x: number
  y: number
  vx: number
  vy: number
  facing: number
  grounded: boolean
}> {
  const [player] = sim.query(Player)
  if (player === undefined) throw new Error('base-2d: the sim has no player')
  return player.get(Player)
}

// Sets up the base's sim: the room as content, the plugin, and the character at the room's start. Demos and
// games start from here (`@af-games/emberwick`), then add their own plugins.
import { type Command, createSim, type PluginDef, type Sim } from '@mcthaydt/automata-sim'
import { parseRoom, type RoomSource } from './content/room.ts'
import { emberwickPlugin, type MoveInput, Player } from './sim/index.ts'
import { placeWick } from './sim/place-wick.ts'
import { TICK_HZ, type Tuning } from './sim/tuning.ts'

export interface BaseSimOptions {
  readonly seed?: number
  /** The room to play: the base's is compiled from `content/` (`content/emberwick-content.ts`). */
  readonly room: RoomSource
  /** The tunables: `content/tuning.toml`'s, in the sim's content. */
  readonly tuning: Tuning
  /** Extra plugins a demo adds on top of the base. */
  readonly plugins?: readonly PluginDef[]
}

export async function createBaseSim(options: BaseSimOptions): Promise<Sim> {
  const room = parseRoom(options.room)
  const sim = await createSim({
    seed: options.seed ?? 1,
    tickHz: TICK_HZ,
    content: { room, tuning: options.tuning },
    plugins: [emberwickPlugin, ...(options.plugins ?? [])],
  })
  placeWick(sim, room)
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
  if (player === undefined) throw new Error('emberwick: the sim has no player')
  return player.get(Player)
}

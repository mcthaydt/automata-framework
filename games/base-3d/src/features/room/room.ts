// The free game's room: the level file the 3D level editor writes (levels/room.af-sector.json), with
// its camera views in the file's `views`, read by the converter (levels/sector-area.ts) for the sim and built by the world
// builder (`roomWorld`) for the eye. A third-person room under the
// angled free-turn camera; the rooms turn freely.
import { buildWorld, type WorldLibrary } from '@automata/3d'
import { type AfSector2File, readLevel } from '@automata/3d/level'
import file from '../../../content/levels/room.af-sector.json'
import type { RoomWorld } from '../../shared/room-world.ts'
import { levelTime } from './room-time.ts'
import { areaFromSector } from './sector-area.ts'

/** The light the room is played in (`room-time.ts`): the file's time of day. */
export const ROOM_TIME = levelTime((file as { readonly time?: AfSector2File['time'] }).time)

/** The room: three platforms and the two channels between them that only the roll crosses. */
export const ROOM = areaFromSector(file, { file: 'room.af-sector.json' })

/**
 * The room the player sees: the same file, built into floors, ceilings, walls and props by the world builder, from the
 * game's own `world-swatch` and `world-prop` content (`content/world-swatches`, `content/world-props`). The compiler
 * parsed each record with those kinds' schemas, so each is that schema's output.
 */
export function roomWorld(content: unknown): RoomWorld {
  const kinds = content as {
    readonly 'world-swatch': WorldLibrary['swatches']
    readonly 'world-prop': NonNullable<WorldLibrary['props']>
  }
  const library: WorldLibrary = { swatches: kinds['world-swatch'], props: kinds['world-prop'] }
  return { world: buildWorld(readLevel(file).level, library), library }
}

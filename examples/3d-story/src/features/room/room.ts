import { readLevel } from '@automata/3d/level'
import { readSectorMap, type SectorMap } from '@automata/sectors/sim'
import file from '../../../content/levels/hall.af-sector.json' with { type: 'json' }
import { type PropShape, type Room, roomOf } from '../../shared/read-room.ts'

// The hall this game plays: content/levels/hall.af-sector.json, which the 3D level editor writes. Change it in the
// editor (pnpm exec automata editor), then press Save.

/** The hall file as the editor wrote it (an older format is brought up to date). */
export const ROOM_LEVEL = readLevel(file).level

/** The hall as the sectors' sim reads it: its floors, the doorway's portals and its walls. */
export const HALL_MAP: SectorMap = readSectorMap(file).level

/** The hall as the player walks it; the props' footprints come from the game's content (content/world-props). */
export function roomIn(content: unknown): Room {
  const kinds = content as { readonly 'world-prop'?: Readonly<Record<string, PropShape>> }
  return roomOf(ROOM_LEVEL, kinds['world-prop'] ?? {})
}

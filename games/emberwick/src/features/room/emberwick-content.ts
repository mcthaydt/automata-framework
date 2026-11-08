import { simContent, simContentHash } from 'virtual:automata/content'
import { levelContentSchema } from '@mcthaydt/automata-content/level-2d'
import { parseRoom, type RoomSource } from '../../shared/room.ts'
import { tuningOf } from '../../shared/tuning.ts'
import { roomSourceOfLevel } from './level-room.ts'

// What the sim receives for the one room: the room the 2D editor exported and the tuning `content/tuning.toml` holds, both
// from the compiled content (`virtual:automata/content`, the content plugin in vite.config.ts).

const compiled = simContent.levels['room-1']
if (compiled === undefined) throw new Error('emberwick: the compiled content has no level "room-1"')
// The compiler checked the file; parsing it again as the editor's level format gives the typed level the readers take.
const level = levelContentSchema.parse(compiled)

/** The base's room as the editor exported it: the one the game plays. */
export const ROOM: RoomSource = roomSourceOfLevel(level)

/** The sim's `content`: the room, checked, and the tunables. */
export const SIM_CONTENT = { room: parseRoom(ROOM), tuning: tuningOf(simContent) }

/** The hash of that content: the page shows it (`#game[data-content-hash]`) so a journey can see a new one arrive. */
export const SIM_CONTENT_HASH: string = simContentHash

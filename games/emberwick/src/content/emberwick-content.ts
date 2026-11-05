import { simContent } from 'virtual:automata/content'
import { tuningOf } from '../sim/tuning.ts'
import { roomSourceOfLevel } from './level-room.ts'
import { parseRoom, type RoomSource } from './room.ts'

// What the sim receives for the one room: the room the 2D editor exported and the tuning `content/tuning.toml` holds, both
// from the compiled content (`virtual:automata/content`, the content plugin in vite.config.ts).

const level = simContent.levels['room-1']
if (level === undefined) throw new Error('emberwick: the compiled content has no level "room-1"')

/** The base's room as the editor exported it: the one the game plays. */
export const ROOM: RoomSource = roomSourceOfLevel(level)

/** The sim's `content`: the room, checked, and the tunables. */
export const SIM_CONTENT = { room: parseRoom(ROOM), tuning: tuningOf(simContent) }

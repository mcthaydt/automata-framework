import type { NavGraph } from '@automata/nav/sim'
import type { PuzzleDef } from '@automata/puzzle/sim'
import type { SectorMap } from '@automata/sectors/sim'
import type { SystemsDef } from '@automata/systems/sim'
import { tuningOf } from '../../shared/tuning.ts'
import type { PlayContent } from '../room/read-room.ts'
import { HALL_MAP, roomIn } from '../room/room.ts'

// What the sim reads of the hall's files: the room Wick walks, the walls the guard sees past, the places it walks
// between, the puzzle's facts and the guard's behaviour. The behaviour, the places and the puzzle are the Schematic
// editor's files (content/systems, content/nav, content/puzzles); the game never copies them, so a Save is a change in play.

/** The scene's name: the file name of its three Schematic files. */
export const SCENE = 'hall'

/** Everything the sim holds as `ctx.content`. */
export interface StoryContent extends PlayContent {
  readonly map: SectorMap
  readonly graph: NavGraph
  readonly puzzle: PuzzleDef
  readonly systems: SystemsDef
}

type Kinds = Readonly<Record<string, Readonly<Record<string, unknown>> | undefined>>

/** One compiled file of a kind, or a sentence that says which file is missing. */
function fileOf<T>(kinds: Kinds, kind: string, folder: string): T {
  const found = kinds[kind]?.[SCENE]
  if (found === undefined)
    throw new Error(`The game has no ${SCENE} in content/${folder}. Check content/${folder}/${SCENE}.toml.`)
  return found as T
}

/** The sim's content, from the game's compiled content. */
export function storyOf(content: unknown): StoryContent {
  const kinds = content as Kinds
  return {
    room: roomIn(content),
    tuning: tuningOf(content),
    map: HALL_MAP,
    graph: fileOf<NavGraph>(kinds, 'nav-graph', 'nav'),
    puzzle: fileOf<PuzzleDef>(kinds, 'puzzle', 'puzzles'),
    systems: fileOf<SystemsDef>(kinds, 'systems', 'systems'),
  }
}

/** The content a system finds in `ctx.content`. */
export const storyIn = (content: unknown): StoryContent => content as StoryContent

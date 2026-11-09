import type { NavGraph } from '@automata/nav/sim'
import type { PuzzleDef } from '@automata/puzzle/sim'
import type { SectorMap } from '@automata/sectors/sim'
import type { SystemsDef } from '@automata/systems/sim'
import type { PlayContent } from '../shared/read-room.ts'

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

/** The content a system finds in `ctx.content`. */
export const storyIn = (content: unknown): StoryContent => content as StoryContent

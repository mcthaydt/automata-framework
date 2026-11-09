import type { NavGraph } from '@automata/nav/sim'
import type { PuzzleDef } from '@automata/puzzle/sim'
import type { SystemsDef } from '@automata/systems/sim'
import { HALL_MAP, roomIn } from '../features/room/room.ts'
import { tuningOf } from '../shared/tuning.ts'
import { SCENE, type StoryContent } from './story.ts'

// The sim's content is put together here, outside the sim: it reads the hall's level file, which the sim must not.
// The sim only ever sees the result, through `storyIn` (`story.ts`).

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

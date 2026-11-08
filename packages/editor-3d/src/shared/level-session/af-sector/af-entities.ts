// The entities of an `af-sector/2` level (ED3D spec §4.7): the file's own `entityDefs` read as typed definitions and its
// `entities` as the things that stand in the level. Nothing is fixed here: what a thing is, the author says.

import type { AfSector2File } from '@automata/3d/level'
import { type EntityKit, readEntityKit } from '../../things/things'
import { EMPTY_LIBRARY, type GameLibrary } from '../game-library'
import { placedDefinitions, placedThings } from './af-placed'

/** What a definition that says nothing of it is: a point with no fields, the way the game reads a bare `{ "id": "ember" }`. */
export const BARE_DEFINITION = { shape: 'point', fields: [] } as const

/** A definition with the members the game defaults filled in, to read it by; the file keeps what it wrote. */
const withDefaults = (value: unknown): unknown =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? { ...BARE_DEFINITION, ...value }
    : value

/**
 * The file's entities, read as the author defined them, and then the level's furniture, characters and lamps, which stand
 * under definitions made from the game (`af-placed.ts`). Those need no reading: they come out of the file's own lists.
 */
export function afEntityKit(level: AfSector2File, library: GameLibrary = EMPTY_LIBRARY): EntityKit {
  const entities = readEntityKit({
    definitions: (level.entityDefs ?? []).map((value, index) => ({
      path: ['entityDefs', index],
      value: withDefaults(value),
    })),
    instances: (level.entities ?? []).map((value, index) => ({ path: ['entities', index], value })),
  })
  return {
    definitions: [...entities.definitions, ...placedDefinitions(level, library)],
    things: [...entities.things, ...placedThings(level)],
    problems: entities.problems,
  }
}

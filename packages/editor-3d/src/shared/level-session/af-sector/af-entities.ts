// The entities of an `af-sector/2` level (ED3D spec §4.7): the file's own `entityDefs` read as typed definitions and its
// `entities` as the things that stand in the level. Nothing is fixed here: what a thing is, the author says.

import type { AfSector2File } from '@automata/3d/level'
import { type EntityKit, readEntityKit } from '../../things/things'

/** What a definition that says nothing of it is: a point with no fields, the way the game reads a bare `{ "id": "ember" }`. */
export const BARE_DEFINITION = { shape: 'point', fields: [] } as const

/** A definition with the members the game defaults filled in, to read it by; the file keeps what it wrote. */
const withDefaults = (value: unknown): unknown =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? { ...BARE_DEFINITION, ...value }
    : value

export function afEntityKit(level: AfSector2File): EntityKit {
  return readEntityKit({
    definitions: (level.entityDefs ?? []).map((value, index) => ({
      path: ['entityDefs', index],
      value: withDefaults(value),
    })),
    instances: (level.entities ?? []).map((value, index) => ({ path: ['entities', index], value })),
  })
}

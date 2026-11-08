// Where the things of an `af-sector/2` level live: one list, `entities`, of `{ def, id, x, z, ...fields }` (ED3D spec
// §4.7). Ids are unique across the file, so an element is found by its definition and id and the codec matches it by id,
// which is why a moved thing is a patch of its `x` and `z` and nothing else.

import type { AfEntity, AfSector2File } from '@automata/3d/level'
import { refsOf } from '../../things/thing-refs'
import type { Thing } from '../../things/things'
import { mergeMembers, newMembers, noThing, type ThingAccess } from '../thing-access'
import { afEntityKit } from './af-entities'

const entitiesOf = (level: AfSector2File): readonly AfEntity[] => level.entities ?? []

/** The index of the entity `def`/`id` in the list, or the sentence for a level that has none. */
function indexOf(level: AfSector2File, def: string, id: string): number {
  const at = entitiesOf(level).findIndex((entity) => entity.def === def && entity.id === id)
  if (at < 0) throw noThing(def, id)
  return at
}

export const afThingAccess: ThingAccess<AfSector2File> = {
  takenIds: (level) => entitiesOf(level).map((entity) => entity.id),

  add: (level, thing) => ({
    ...level,
    entities: [...entitiesOf(level), newMembers(thing, { def: thing.def, id: thing.id }) as AfEntity],
  }),

  replace(level, def, id, thing) {
    const at = indexOf(level, def, id)
    const entities = entitiesOf(level)
    const old = entities[at] as AfEntity
    const next = mergeMembers(old, thing, { def, id })
    return next === old
      ? level
      : { ...level, entities: entities.map((entity, index) => (index === at ? next : entity)) }
  },

  remove(level, def, id) {
    const at = indexOf(level, def, id)
    return { ...level, entities: entitiesOf(level).filter((_, index) => index !== at) }
  },

  references(level, def, id) {
    const kit = afEntityKit(level)
    const fieldsOf = new Map(kit.definitions.map((definition) => [definition.id, definition.fields ?? []]))
    return kit.things.flatMap((other: Thing) =>
      other.def === def && other.id === id
        ? []
        : refsOf(other, fieldsOf.get(other.def) ?? [])
            .filter((ref) => ref.target === id)
            .map((ref) => `entity ${other.id}: ${ref.which} points at ${id}`),
    )
  },
}

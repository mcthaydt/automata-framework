// Where the definitions of an `af-sector/1` level live: one list, `entityDefs`, whose ids the codec matches elements by,
// and the `def` member of each of `entities` (ED3D spec §4.6, §4.7).

import type { AfEntity, AfEntityDef, AfSector } from '@automata/3d/level'
import type { ThingDef } from '../../entities/thing-def.schema'
import { sameJson, withoutUndefined } from '../../model/json-values'
import type { DefinitionAccess, InstanceRename } from '../definition-access'

const defsOf = (level: AfSector): readonly AfEntityDef[] => level.entityDefs ?? []

function indexOf(level: AfSector, id: string): number {
  const at = defsOf(level).findIndex((def) => def.id === id)
  if (at < 0) throw new RangeError(`no entity definition ${id}`)
  return at
}

/** `old` carrying the members of `next`: its own keys in their order, one `next` lacks dropped, a new one appended. */
function merged(old: AfEntityDef, next: ThingDef): AfEntityDef {
  const now = new Map(Object.entries(withoutUndefined(next)))
  const out: Record<string, unknown> = {}
  let changed = false
  // A member that is equal keeps the file's own value, so its nested members stay in the file's order too.
  for (const [key, value] of Object.entries(old)) {
    if (!now.has(key)) changed = true
    else if (sameJson(value, now.get(key))) out[key] = value
    else {
      out[key] = now.get(key)
      changed = true
    }
  }
  for (const [key, value] of now)
    if (!Object.hasOwn(old, key)) {
      out[key] = value
      changed = true
    }
  return changed ? (out as AfEntityDef) : old
}

/** A raw field that is an object with an `id` and a `to` list: the only shape whose `to` can name a definition. */
type RawPointer = { readonly id: string; readonly to: readonly unknown[] }

const isPointer = (field: unknown): field is RawPointer =>
  typeof field === 'object' &&
  field !== null &&
  typeof (field as { id?: unknown }).id === 'string' &&
  Array.isArray((field as { to?: unknown }).to)

/** The raw fields of a definition as the file holds them; anything but a list holds none. */
const rawFields = (def: AfEntityDef): readonly unknown[] => (Array.isArray(def.fields) ? def.fields : [])

/** `def` with every `to` naming `from` naming `to`; the very definition when none does. */
function retargetedDef(def: AfEntityDef, from: string, to: string): AfEntityDef {
  const fields = rawFields(def)
  let changed = false
  const next = fields.map((field) => {
    if (!isPointer(field) || !field.to.includes(from)) return field
    changed = true
    return { ...field, to: field.to.map((name) => (name === from ? to : name)) }
  })
  return changed ? { ...def, fields: next } : def
}

/**
 * One instance renamed, its members in their own order; the very instance when nothing changes. This is the kit's `renameFieldValues` (a value moves to its new key in its own place, and a
 * stray value already under that key gives way) done on the raw members, because an instance in the file also holds
 * `def`, `id`, `x`, `z` and members no field reads, which the kit's values do not, and all of them keep their places.
 */
function renamed(entity: AfEntity, rename: InstanceRename): AfEntity {
  const { def, field } = rename
  const renamesDef = def !== undefined && def !== entity.def
  const renamesField = field !== undefined && field.from !== field.to && Object.hasOwn(entity, field.from)
  if (!renamesDef && !renamesField) return entity
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(entity)) {
    if (key === 'def') out.def = renamesDef ? def : value
    else if (renamesField && key === field.from) out[field.to] = value
    // A stray member already under the new name is replaced by the value that is renamed onto it.
    else if (!(renamesField && key === field.to)) out[key] = value
  }
  return out as AfEntity
}

export const afDefinitionAccess: DefinitionAccess<AfSector> = {
  ids: (level) => defsOf(level).map((def) => def.id),

  add: (level, def) => ({ ...level, entityDefs: [...defsOf(level), { ...withoutUndefined(def) }] }),

  replace(level, id, def) {
    const at = indexOf(level, id)
    const defs = defsOf(level)
    const old = defs[at] as AfEntityDef
    const next = merged(old, def)
    return next === old
      ? level
      : { ...level, entityDefs: defs.map((each, index) => (index === at ? next : each)) }
  },

  remove(level, id) {
    const at = indexOf(level, id)
    return { ...level, entityDefs: defsOf(level).filter((_, index) => index !== at) }
  },

  pointersTo: (level, id) =>
    defsOf(level).flatMap((def) =>
      rawFields(def).flatMap((field) =>
        isPointer(field) && field.to.includes(id) ? [{ def: def.id, field: field.id }] : [],
      ),
    ),

  retarget(level, from, to) {
    const defs = defsOf(level)
    const next = defs.map((def) => retargetedDef(def, from, to))
    return next.some((def, index) => def !== defs[index]) ? { ...level, entityDefs: next } : level
  },

  renameInstances(level, def, rename) {
    const entities = level.entities ?? []
    let changed = false
    const next = entities.map((entity) => {
      if (entity.def !== def) return entity
      const out = renamed(entity, rename)
      if (out !== entity) changed = true
      return out
    })
    return changed ? { ...level, entities: next } : level
  },
}

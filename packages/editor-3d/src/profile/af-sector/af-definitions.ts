// Where the definitions of an `af-sector/1` level live: one list, `entityDefs`, whose ids the codec matches elements by,
// and the `def` member of each of `entities` (ED3D spec §4.6, §4.7).
import type { ThingDef } from '../../entities/thing-def.schema'
import type { AfEntity, AfEntityDef, AfSector } from '../../format/af-sector.schema'
import type { DefinitionAccess, InstanceRename } from '../definition-access'

const defsOf = (level: AfSector): readonly AfEntityDef[] => level.entityDefs ?? []

function indexOf(level: AfSector, id: string): number {
  const at = defsOf(level).findIndex((def) => def.id === id)
  if (at < 0) throw new RangeError(`no entity definition ${id}`)
  return at
}

/** Deep equality of JSON values whatever the order of their members: a parsed definition lists its keys in schema order. */
function same(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b))
    return (
      Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, i) => same(item, b[i]))
    )
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return a === b
  const keys = Object.keys(a)
  return (
    keys.length === Object.keys(b).length &&
    keys.every(
      (key) =>
        Object.hasOwn(b, key) &&
        same((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
    )
  )
}

/** A definition as the file writes it: a member set to `undefined` is not written. */
const written = (def: ThingDef): AfEntityDef =>
  Object.fromEntries(Object.entries(def).filter(([, value]) => value !== undefined)) as AfEntityDef

/** `old` carrying the members of `next`: its own keys in their order, one `next` lacks dropped, a new one appended. */
function merged(old: AfEntityDef, next: ThingDef): AfEntityDef {
  const now = new Map(Object.entries(written(next)))
  const out: Record<string, unknown> = {}
  let changed = false
  // A member that is equal keeps the file's own value, so its nested members stay in the file's order too.
  for (const [key, value] of Object.entries(old)) {
    if (!now.has(key)) changed = true
    else if (same(value, now.get(key))) out[key] = value
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

/** One instance renamed, its members in their own order; the very instance when nothing changes. */
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

  add: (level, def) => ({ ...level, entityDefs: [...defsOf(level), written(def)] }),

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

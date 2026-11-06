import type { FieldDef, FieldValues } from '../../../kit/fields/field-types.ts'
import type { EntityDef2D, Level, Project } from '../project-types'

// Who carries a set of typed fields: an entity definition, whose instances hold the
// values, or the project's level fields, whose values every level holds. The field commands and the delete refusals
// read and rewrite both the same way through here.

export type FieldOwner = 'level' | { readonly entity: string }

/** One holder of values: an entity instance or a level, with its path as the Checks spell it. */
export interface ValueHolder {
  readonly id: string
  readonly path: string
  readonly values: FieldValues
}

export function entityDefOf(project: Project, id: string): EntityDef2D {
  const found = project.defs.entities.find((candidate) => candidate.id === id)
  if (found === undefined) throw new RangeError(`no entity definition "${id}"`)
  return found
}

export function fieldsOf(project: Project, owner: FieldOwner): readonly FieldDef[] {
  return owner === 'level' ? project.defs.levelFields : entityDefOf(project, owner.entity).fields
}

/** The project with the owner's field definitions replaced. */
export function withFields(project: Project, owner: FieldOwner, fields: readonly FieldDef[]): Project {
  if (owner === 'level') return { ...project, defs: { ...project.defs, levelFields: fields } }
  const def = entityDefOf(project, owner.entity)
  return {
    ...project,
    defs: {
      ...project.defs,
      entities: project.defs.entities.map((candidate) =>
        candidate === def ? { ...def, fields } : candidate,
      ),
    },
  }
}

export const levelPath = (level: string): string => `levels[${level}]`
export const itemPath = (level: string, layer: string, item: string): string =>
  `${levelPath(level)}.layers[${layer}].items[${item}]`

/** Every holder of the owner's values, level by level and in layer order. */
export function valueHolders(project: Project, owner: FieldOwner): ValueHolder[] {
  if (owner === 'level')
    return project.levels.map((level) => ({ id: level.id, path: levelPath(level.id), values: level.fields }))
  entityDefOf(project, owner.entity)
  const holders: ValueHolder[] = []
  for (const level of project.levels) {
    for (const layer of level.layers) {
      if (layer.kind !== 'entities') continue
      for (const item of layer.items) {
        if (item.def === owner.entity)
          holders.push({ id: item.id, path: itemPath(level.id, layer.def, item.id), values: item.fields })
      }
    }
  }
  return holders
}

function mapLevel(
  level: Level,
  owner: FieldOwner,
  edit: (values: FieldValues, id: string) => FieldValues,
): Level {
  if (owner === 'level') {
    const fields = edit(level.fields, level.id)
    return fields === level.fields ? level : { ...level, fields }
  }
  let changed = false
  const layers = level.layers.map((layer) => {
    if (layer.kind !== 'entities') return layer
    let layerChanged = false
    const items = layer.items.map((item) => {
      if (item.def !== owner.entity) return item
      const fields = edit(item.fields, item.id)
      if (fields === item.fields) return item
      layerChanged = true
      return { ...item, fields }
    })
    if (!layerChanged) return layer
    changed = true
    return { ...layer, items }
  })
  return changed ? { ...level, layers } : level
}

/**
 * The project with `edit` applied to every holder's values. A holder `edit` returns unchanged, and every level and
 * layer with no changed holder, stays the same object.
 */
export function mapValues(
  project: Project,
  owner: FieldOwner,
  edit: (values: FieldValues, id: string) => FieldValues,
): Project {
  let changed = false
  const levels = project.levels.map((level) => {
    const next = mapLevel(level, owner, edit)
    if (next !== level) changed = true
    return next
  })
  return changed ? { ...project, levels } : project
}

import type { FieldDef, FieldValue, FieldValues, RefValue } from '@mcthaydt/automata-editor-kit/fields'
import type { Project } from '../project-types'
import { isRefValue, type RefIndex, refIndex, resolveRef } from './ref-resolve'

// The links a project's `ref` fields make (plan ED2D.6c; 2D editor spec §5.7, §8 flow 4): every value that resolves,
// as the level canvas and the world map draw it; what the reference picker offers for a field; and the name a link is
// shown by. A broken value is no link: the Checks report it and nothing draws it (G-g).

const LEVEL = '$level'

export interface LinkItem {
  readonly id: string
  readonly def: string
  readonly x: number
  readonly y: number
}

/** One end of a link: a level, or an instance in it. */
export interface LinkEnd {
  readonly level: string
  readonly item?: LinkItem
}

export interface ProjectLink {
  /** The holder of the field: an instance, or the level itself for a level field. */
  readonly from: LinkEnd
  readonly field: string
  readonly to: LinkEnd
}

function refsOf(field: FieldDef, value: FieldValue | undefined): readonly RefValue[] {
  const entries = field.list === true ? (Array.isArray(value) ? value : []) : [value]
  return entries.filter(isRefValue)
}

function linksOf(
  fields: readonly FieldDef[],
  values: FieldValues,
  from: LinkEnd,
  index: RefIndex,
): ProjectLink[] {
  const found: ProjectLink[] = []
  for (const field of fields) {
    if (field.type !== 'ref') continue
    for (const ref of refsOf(field, values[field.id])) {
      const resolved = resolveRef(index, field, ref)
      if (!resolved.ok) continue
      const to =
        resolved.item === undefined
          ? { level: resolved.level }
          : { level: resolved.level, item: resolved.item }
      found.push({ from, field: field.id, to })
    }
  }
  return found
}

/** Every resolved link, in level order: each level's own fields first, then its instances in layer order. */
export function projectLinks(project: Project): readonly ProjectLink[] {
  const index = refIndex(project)
  const defs = new Map(project.defs.entities.map((def) => [def.id, def]))
  const found: ProjectLink[] = []
  for (const level of project.levels) {
    found.push(...linksOf(project.defs.levelFields, level.fields, { level: level.id }, index))
    for (const layer of level.layers) {
      if (layer.kind !== 'entities') continue
      for (const item of layer.items) {
        const def = defs.get(item.def)
        if (def === undefined) continue
        const from = { level: level.id, item: { id: item.id, def: item.def, x: item.x, y: item.y } }
        found.push(...linksOf(def.fields, item.fields, from, index))
      }
    }
  }
  return found
}

export interface RefChoice {
  readonly label: string
  readonly value: RefValue
}

/** A level in the picker with what in it the field may point at. */
export interface RefTargetLevel {
  readonly level: string
  readonly name: string
  readonly choices: readonly RefChoice[]
}

const defLabel = (project: Project, id: string): string =>
  project.defs.entities.find((def) => def.id === id)?.label ?? id

/**
 * What a field may be pointed at, by level in project order (plan ED2D.6c decision 2): the level itself first when `to`
 * allows a level (or is empty), then each instance of an allowed definition in layer order. `holder` (the instance the
 * field belongs to) is never a choice. A level with nothing to offer is left out.
 */
export function refTargets(
  project: Project,
  field: FieldDef,
  holder: string | undefined,
): readonly RefTargetLevel[] {
  const allowed = field.to ?? []
  const any = allowed.length === 0
  const found: RefTargetLevel[] = []
  for (const level of project.levels) {
    const choices: RefChoice[] = []
    if (any || allowed.includes(LEVEL))
      choices.push({ label: 'The level itself', value: { target: level.id } })
    for (const layer of level.layers) {
      if (layer.kind !== 'entities') continue
      for (const item of layer.items)
        if (item.id !== holder && (any || allowed.includes(item.def)))
          choices.push({
            label: `${defLabel(project, item.def)} at ${item.x}, ${item.y}`,
            value: { target: item.id, container: level.id },
          })
    }
    if (choices.length > 0) found.push({ level: level.id, name: level.name, choices })
  }
  return found
}

/** A resolved value's name: `<level name> · <definition label>`, or the level's name; `undefined` when it is broken. */
export function refName(project: Project, field: FieldDef, value: RefValue): string | undefined {
  const resolved = resolveRef(refIndex(project), field, value)
  if (!resolved.ok) return undefined
  const level = project.levels.find((each) => each.id === resolved.level)?.name ?? resolved.level
  return resolved.item === undefined ? level : `${level} · ${defLabel(project, resolved.item.def)}`
}

import type { FieldDef, FieldType, FieldValue } from '@mcthaydt/automata-editor-kit/fields'
import type { FieldOwner } from '../../model/commands/field-owner'
import type { EntityDef2D, Project } from '../../model/project-types'

// What the Entities view shows (plan ED2D.5c decisions 1, 4, 5, 7 and 8; 2D editor spec §8, the Entities row): the
// definition and level-field rows of the panel, the selection resolved against the project, the preview's geometry and
// the field list's summaries. Plain functions of the project, so the Svelte files only draw them.

/** Whose fields the inspector edits: an entity definition, or every level. */
export type EntitiesOwner = FieldOwner

export interface EntitiesSelection {
  readonly owner?: EntitiesOwner
  readonly field?: string
}

export interface ResolvedEntitiesSelection {
  readonly owner: EntitiesOwner
  /** The selected entity definition; undefined when the level fields are selected. */
  readonly def: EntityDef2D | undefined
  readonly fields: readonly FieldDef[]
  readonly field: FieldDef | undefined
}

export interface DefinitionRow {
  readonly id: string
  readonly label: string | undefined
  readonly color: string | undefined
  readonly summary: string
}

export interface FieldListRow {
  readonly id: string
  readonly label: string | undefined
  readonly type: FieldType
  readonly summary: string
  readonly required: boolean
}

export interface DefinitionPreview {
  /** Preview pixels per definition pixel. */
  readonly scale: number
  /** The shape's box in preview pixels. */
  readonly box: { readonly w: number; readonly h: number }
  /** The pivot within the box, in preview pixels. */
  readonly pivot: { readonly x: number; readonly y: number }
  readonly shape: EntityDef2D['shape']
  readonly color: string | undefined
  readonly tile: EntityDef2D['tile']
  readonly sizeText: string
  readonly pivotText: string
  readonly instances: string
}

const MAX_SCALE = 8

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`

export function definitionRows(project: Project): readonly DefinitionRow[] {
  return project.defs.entities.map((def) => ({
    id: def.id,
    label: def.label,
    color: def.color,
    summary: [plural(def.fields.length, 'field'), def.shape, ...(def.single === true ? ['single'] : [])].join(
      ' · ',
    ),
  }))
}

function valueText(value: FieldValue): string {
  if (typeof value === 'string') return value === '' ? '“”' : value
  if (typeof value === 'boolean') return value ? 'on' : 'off'
  if (typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.map(valueText).join(' ')
  if ('x' in value) return `${value.x}, ${value.y}`
  return value.id
}

function boundsText(field: FieldDef): string | undefined {
  if (field.min !== undefined && field.max !== undefined) return `${field.min} to ${field.max}`
  if (field.min !== undefined) return `at least ${field.min}`
  if (field.max !== undefined) return `at most ${field.max}`
  return undefined
}

/** `enum · N E S W · default S`: the type, then what that type adds, then the default. */
export function fieldSummary(field: FieldDef): string {
  const parts: string[] = [field.type]
  if (field.list === true) parts.push('list')
  const bounds = boundsText(field)
  if (bounds !== undefined) parts.push(bounds)
  if (field.options !== undefined) parts.push(field.options.join(' '))
  if (field.multiline === true) parts.push('multiline')
  if (field.to !== undefined && field.to.length > 0) parts.push(field.to.join(' '))
  if (field.default !== undefined) parts.push(`default ${valueText(field.default)}`)
  return parts.join(' · ')
}

export function fieldRows(fields: readonly FieldDef[]): readonly FieldListRow[] {
  return fields.map((field) => ({
    id: field.id,
    label: field.label,
    type: field.type,
    summary: fieldSummary(field),
    required: field.required === true,
  }))
}

export function levelFieldRows(project: Project): readonly FieldListRow[] {
  return fieldRows(project.defs.levelFields)
}

const ITEM_PATH = /^levels\[([^\]]+)\]\.layers\[[^\]]+\]\.items\[([^\]]+)\](?:\.fields\..+)?$/
const LEVEL_PATH = /^levels\[([^\]]+)\](?:\.fields\..+)?$/

/** A refusal's use as a person reads it (decision 8): `slime-2 in level-1`, or the level; anything else as it is. */
export function useLabel(path: string): string {
  const item = ITEM_PATH.exec(path)
  if (item !== null) return `${item[2]} in ${item[1]}`
  return LEVEL_PATH.exec(path)?.[1] ?? path
}

export function resolveSelection(project: Project, selection: EntitiesSelection): ResolvedEntitiesSelection {
  const { entities, levelFields } = project.defs
  const wanted = selection.owner
  const def =
    wanted === 'level'
      ? undefined
      : (entities.find((candidate) => candidate.id === wanted?.entity) ?? entities[0])
  const owner: EntitiesOwner = def === undefined ? 'level' : { entity: def.id }
  const fields = def === undefined ? levelFields : def.fields
  const field = fields.find((candidate) => candidate.id === selection.field) ?? fields[0]
  return { owner, def, fields, field }
}

function instanceText(project: Project, id: string): string {
  let count = 0
  let levels = 0
  for (const level of project.levels) {
    let inLevel = 0
    for (const layer of level.layers)
      if (layer.kind === 'entities') inLevel += layer.items.filter((item) => item.def === id).length
    count += inLevel
    if (inLevel > 0) levels++
  }
  return count === 0 ? 'no instances' : `${plural(count, 'instance')} · ${plural(levels, 'level')}`
}

/** The preview of definition `id` drawn in a `room` of preview pixels (decision 7). */
export function definitionPreview(
  project: Project,
  id: string,
  room: { readonly w: number; readonly h: number },
): DefinitionPreview {
  const def = project.defs.entities.find((candidate) => candidate.id === id)
  if (def === undefined) throw new RangeError(`no entity definition "${id}"`)
  const { size, pivot } = def
  const fit = Math.floor(Math.min(room.w / size.w, room.h / size.h))
  const scale = Math.max(1, Math.min(MAX_SCALE, fit))
  const box = { w: size.w * scale, h: size.h * scale }
  return {
    scale,
    box,
    pivot: { x: box.w * pivot.x, y: box.h * pivot.y },
    shape: def.shape,
    color: def.color,
    tile: def.tile,
    sizeText: `${def.shape} ${size.w}×${size.h} px`,
    pivotText: `pivot ${pivot.x}, ${pivot.y}`,
    instances: instanceText(project, id),
  }
}

/**
 * The field as type `type` (decision 4): its id, label, list and required stay; the old type's default, bounds,
 * options, multiline and targets go. A new enum gets the option `a`, since an enum needs one to be valid.
 */
export function withType(field: FieldDef, type: FieldType): FieldDef {
  if (field.type === type) return field
  const { id, label, list, required } = field
  return {
    id,
    type,
    ...(label === undefined ? {} : { label }),
    ...(list === undefined ? {} : { list }),
    ...(required === undefined ? {} : { required }),
    ...(type === 'enum' ? { options: ['a'] } : {}),
  }
}

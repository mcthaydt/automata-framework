import type { FieldDef, FieldValue, FieldValues, RefValue } from '@mcthaydt/automata-editor-kit/fields'
import type { Project } from '../../../model/project-types'
import type { Diagnostic } from '../../profile'
import { diagnostic, itemPath, levelPath } from './diagnostics'

// Checks of references between things (2D editor spec §9, "Links"). A `ref` field's `to` says what it may point at:
// `$level` is a level id and any other entry is an entity definition id, whose instances are found by their id (ids
// are unique in a project). A value with a `container` must be in that level. Whether a value has the right shape is
// the kit's check (`fieldInvalid`); here only a well-formed ref is followed.

const LEVEL = '$level'

const isRef = (value: FieldValue | undefined): value is RefValue =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  typeof (value as { target?: unknown }).target === 'string'

interface Index {
  readonly levels: ReadonlySet<string>
  /** Instance id to the definition and the level it is in. */
  readonly instances: ReadonlyMap<string, { readonly def: string; readonly level: string }>
}

function indexOf(project: Project): Index {
  const instances = new Map<string, { def: string; level: string }>()
  for (const level of project.levels) {
    for (const layer of level.layers) {
      if (layer.kind !== 'entities') continue
      for (const item of layer.items) instances.set(item.id, { def: item.def, level: level.id })
    }
  }
  return { levels: new Set(project.levels.map((level) => level.id)), instances }
}

/** Why a ref does not resolve, as a diagnostic's code and message, or `undefined` when it does. */
function refProblem(
  ref: RefValue,
  field: FieldDef,
  index: Index,
): { code: string; message: string } | undefined {
  const allowed = field.to ?? []
  const any = allowed.length === 0
  const target = ref.target
  const instance = index.instances.get(target)
  if (instance === undefined) {
    const isLevel =
      ref.container === undefined && index.levels.has(target) && (any || allowed.includes(LEVEL))
    return isLevel ? undefined : { code: 'brokenRef', message: `"${target}" does not exist.` }
  }
  if (ref.container !== undefined && instance.level !== ref.container) {
    return {
      code: 'brokenRef',
      message: `"${target}" is not in level "${ref.container}"${index.levels.has(ref.container) ? '' : ', which does not exist'}.`,
    }
  }
  if (!any && !allowed.includes(instance.def)) {
    return {
      code: 'refWrongKind',
      message: `"${target}" is a ${instance.def}, but "${field.id}" points at ${allowed.map((entry) => (entry === LEVEL ? 'a level' : entry)).join(', ')}.`,
    }
  }
  return undefined
}

function fieldRefs(
  fields: readonly FieldDef[],
  values: FieldValues,
  path: string,
  index: Index,
): Diagnostic[] {
  const found: Diagnostic[] = []
  for (const field of fields) {
    if (field.type !== 'ref') continue
    const value = values[field.id]
    const entries = field.list === true ? (Array.isArray(value) ? value : []) : [value]
    entries.forEach((entry, position) => {
      if (!isRef(entry)) return
      const problem = refProblem(entry, field, index)
      if (problem === undefined) return
      const at =
        field.list === true ? `${path}.fields.${field.id}[${position}]` : `${path}.fields.${field.id}`
      found.push(diagnostic('error', problem.code, at, problem.message, 'choose-target'))
    })
  }
  return found
}

export function linkChecks(project: Project): Diagnostic[] {
  const index = indexOf(project)
  const defs = new Map(project.defs.entities.map((def) => [def.id, def]))
  const found: Diagnostic[] = []
  for (const level of project.levels) {
    found.push(...fieldRefs(project.defs.levelFields, level.fields, levelPath(level.id), index))
    for (const layer of level.layers) {
      if (layer.kind !== 'entities') continue
      for (const item of layer.items) {
        const def = defs.get(item.def)
        if (def !== undefined) {
          found.push(...fieldRefs(def.fields, item.fields, itemPath(level.id, layer.def, item.id), index))
        }
      }
    }
  }
  return found
}

import type { FieldDef, FieldValues } from '@automataframework/automata-content/level-2d'
import type { Project } from '../../../model/project-types'
import { isRefValue, type RefIndex, refIndex, resolveRef } from '../../../model/refs/ref-resolve'
import type { Diagnostic } from '../../profile'
import { diagnostic, itemPath, levelPath } from './diagnostics'

// Checks of references between things. What a value points at is `resolveRef`'s rule
// (`model/refs/`), which the reference picker and the canvases share. Whether a value has the right shape is the kit's
// check (`fieldInvalid`); here only a well-formed ref is followed.

function fieldRefs(
  fields: readonly FieldDef[],
  values: FieldValues,
  path: string,
  index: RefIndex,
): Diagnostic[] {
  const found: Diagnostic[] = []
  for (const field of fields) {
    if (field.type !== 'ref') continue
    const value = values[field.id]
    const entries = field.list === true ? (Array.isArray(value) ? value : []) : [value]
    entries.forEach((entry, position) => {
      if (!isRefValue(entry)) return
      const problem = resolveRef(index, field, entry)
      if (problem.ok) return
      const at =
        field.list === true ? `${path}.fields.${field.id}[${position}]` : `${path}.fields.${field.id}`
      found.push(diagnostic('error', problem.code, at, problem.message, 'choose-target'))
    })
  }
  return found
}

export function linkChecks(project: Project): Diagnostic[] {
  const index = refIndex(project)
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

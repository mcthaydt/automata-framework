import type { FieldDef, FieldValue } from '@mcthaydt/automata-editor-kit/fields'
import { setEntityField } from '../../model/commands/entity-edits'
import { findLayer } from '../../model/commands/layer-target'
import type { Project } from '../../model/project-types'
import { setLevelField } from '../../model/world/level-edits'
import type { EditHistory } from '../level-editor'

// One inspector field committed as one undo step (plan ED2D.4c4b decision 1, G-e). The commands refuse a value the
// field's rules reject with a `RangeError` carrying the kit's `checkFieldValue` message; here that refusal becomes a
// result the field editor shows under the field, and nothing is applied, so the stored value stays and the history
// gains no step. The command runs once against the current state first, so a refusal never reaches the history and an
// unchanged value (the command returns the same project) adds no empty step.

export type FieldTarget =
  | { readonly kind: 'entity'; readonly level: string; readonly layer: string; readonly id: string }
  | { readonly kind: 'level'; readonly level: string }

export type FieldCommit = { readonly ok: true } | { readonly ok: false; readonly message: string }

function fieldDefOf(project: Project, target: FieldTarget, field: string): FieldDef | undefined {
  if (target.kind === 'level') return project.defs.levelFields.find((candidate) => candidate.id === field)
  const { layer } = findLayer(project, target)
  const instance = layer.kind === 'entities' ? layer.items.find((item) => item.id === target.id) : undefined
  const def = project.defs.entities.find((candidate) => candidate.id === instance?.def)
  return def?.fields.find((candidate) => candidate.id === field)
}

export function commitField(
  history: EditHistory,
  target: FieldTarget,
  field: string,
  value: FieldValue,
): FieldCommit {
  const edit = (project: Project): Project =>
    target.kind === 'level'
      ? setLevelField(project, target.level, field, value)
      : setEntityField(project, target, target.id, field, value)
  const before = history.state
  let after: Project
  try {
    after = edit(before)
  } catch (error) {
    if (error instanceof RangeError) return { ok: false, message: error.message }
    throw error
  }
  if (after === before) return { ok: true }
  const def = fieldDefOf(before, target, field)
  history.apply(`Set ${def?.label ?? field}`, edit)
  return { ok: true }
}

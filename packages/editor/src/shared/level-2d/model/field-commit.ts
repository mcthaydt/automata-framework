import type { FieldDef, FieldValue } from '../../kit/fields/field-types.ts'
import { setEntityField } from './commands/entity-edits'
import { findLayer } from './commands/layer-target'
import type { EditHistory } from './edit-history'
import type { Project } from './project-types'
import { setLevelField } from './world/level-edits'

// One inspector field committed as one undo step. The commands refuse a value the
// field's rules reject with a `RangeError` carrying the kit's `checkFieldValue` message; here that refusal becomes a
// result the field editor shows under the field, and nothing is applied, so the stored value stays and the history
// gains no step. The command runs once against the current state first, so a refusal never reaches the history and an
// unchanged value (the command returns the same project) adds no empty step.

export type FieldTarget =
  | { readonly kind: 'entity'; readonly level: string; readonly layer: string; readonly id: string }
  | { readonly kind: 'level'; readonly level: string }

// The kit owns the result type the field form takes (plan "field form and journeys" A2).
import type { FieldCommit } from '../../kit/fields/field-row.ts'

export type { FieldCommit }

function fieldDefOf(project: Project, target: FieldTarget, field: string): FieldDef | undefined {
  if (target.kind === 'level') return project.defs.levelFields.find((candidate) => candidate.id === field)
  const { layer } = findLayer(project, target)
  const instance = layer.kind === 'entities' ? layer.items.find((item) => item.id === target.id) : undefined
  const def = project.defs.entities.find((candidate) => candidate.id === instance?.def)
  return def?.fields.find((candidate) => candidate.id === field)
}

/**
 * Runs `edit` once on the current state: a `RangeError` (a value or target the model refuses) is returned as its
 * message with nothing applied, the same project back adds no step, and anything else is applied as one `label` step.
 */
export function commitEdit<S = Project>(
  history: { readonly state: S; apply(label: string, update: (state: S) => S): void },
  label: string,
  edit: (state: S) => S,
): FieldCommit {
  const before = history.state
  let after: S
  try {
    after = edit(before)
  } catch (error) {
    if (error instanceof RangeError) return { ok: false, message: error.message }
    throw error
  }
  if (after !== before) history.apply(label, edit)
  return { ok: true }
}

export function commitField(
  history: EditHistory,
  target: FieldTarget,
  field: string,
  value: FieldValue,
): FieldCommit {
  const def = fieldDefOf(history.state, target, field)
  return commitEdit(history, `Set ${def?.label ?? field}`, (project) =>
    target.kind === 'level'
      ? setLevelField(project, target.level, field, value)
      : setEntityField(project, target, target.id, field, value),
  )
}

import {
  type EntityDef,
  FIELD_ID,
  type FieldDef,
  type FieldValues,
  type InstanceProblem,
} from './field-types'
import { checkFieldInstance } from './field-values'

/** One instance of the entity whose field is being changed. */
export interface FieldInstance {
  readonly id: string
  readonly values: FieldValues
}

export interface RetypeBreakage {
  readonly instanceId: string
  /** What is wrong with that instance's value under the new definition; its `fieldId` is the new id. */
  readonly problem: InstanceProblem
}

/**
 * Before a definitions editor changes a field's type, bounds, options, list flag or `required`: the instances whose
 * value would stop validating, so the editor refuses with a list and never loses data silently. An instance that
 * already failed the old definition is not listed (`checkValues` reports it); the retype did not break it. The
 * value is read by `oldDef.id`, so a rename combined with a retype is one call.
 */
export function checkRetype(
  oldDef: FieldDef,
  newDef: FieldDef,
  instances: readonly FieldInstance[],
): readonly RetypeBreakage[] {
  const breakages: RetypeBreakage[] = []
  for (const instance of instances) {
    if (checkFieldInstance(oldDef, instance.values)) continue
    const problem = checkFieldInstance({ ...newDef, id: oldDef.id }, instance.values)
    if (problem) breakages.push({ instanceId: instance.id, problem: { ...problem, fieldId: newDef.id } })
  }
  return breakages
}

export type RenameResult =
  | { readonly ok: true; readonly def: EntityDef }
  | { readonly ok: false; readonly code: 'unknownField' | 'badId' | 'duplicateFieldId' }

/**
 * The entity definition with one field's id changed, in place. Instances keep their values with
 * `renameFieldValues`. Neither the definition nor the instances are changed here.
 */
export function renameField(def: EntityDef, from: string, to: string): RenameResult {
  if (!def.fields.some((field) => field.id === from)) return { ok: false, code: 'unknownField' }
  if (!FIELD_ID.test(to)) return { ok: false, code: 'badId' }
  if (from === to) return { ok: true, def }
  if (def.fields.some((field) => field.id === to)) return { ok: false, code: 'duplicateFieldId' }
  return {
    ok: true,
    def: { ...def, fields: def.fields.map((field) => (field.id === from ? { ...field, id: to } : field)) },
  }
}

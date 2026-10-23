import { defaultFieldValue } from './check-field-def'
import { checkFieldValue } from './check-field-value'
import type { FieldDef, FieldValue, FieldValues, InstanceProblem } from './field-types'

const hasValue = (values: FieldValues, id: string): boolean =>
  Object.hasOwn(values, id) && values[id] !== undefined

/**
 * Problems for a whole instance: each field's value checked in definition order, a missing required field
 * as `fieldMissing`, then every value whose id has no field as `unknownField`, in sorted order.
 */
export function checkValues(fields: readonly FieldDef[], values: FieldValues): readonly InstanceProblem[] {
  const problems: InstanceProblem[] = []
  for (const field of fields) {
    if (!hasValue(values, field.id)) {
      if (field.required) {
        problems.push({ code: 'fieldMissing', message: `${field.id} is required`, fieldId: field.id })
      }
      continue
    }
    const misfit = checkFieldValue(field, values[field.id])
    if (misfit) problems.push({ ...misfit, fieldId: field.id })
  }
  const known = new Set(fields.map((field) => field.id))
  for (const id of Object.keys(values).sort()) {
    if (!known.has(id))
      problems.push({ code: 'unknownField', message: `${id} is not a field of this entity`, fieldId: id })
  }
  return problems
}

/**
 * The instance's values with every missing field that has a stand-in filled in: its default, else its type's zero.
 * Required fields and refs without a default stay missing. Returns the same object when nothing is filled.
 */
export function valuesWithDefaults(fields: readonly FieldDef[], values: FieldValues): FieldValues {
  const filled: Record<string, FieldValue> = {}
  let any = false
  for (const field of fields) {
    if (hasValue(values, field.id)) continue
    const fallback = defaultFieldValue(field)
    if (fallback === undefined) continue
    filled[field.id] = fallback
    any = true
  }
  return any ? { ...values, ...filled } : values
}

/**
 * Moves the value stored under `from` to `to`, keeping its place in the key order. A stray value already under
 * `to` is replaced. Returns the same object when there is nothing to move.
 */
export function renameFieldValues(values: FieldValues, from: string, to: string): FieldValues {
  if (from === to || !Object.hasOwn(values, from)) return values
  const renamed: Record<string, FieldValue> = {}
  for (const [id, value] of Object.entries(values)) {
    if (id === to) continue
    renamed[id === from ? to : id] = value
  }
  return renamed
}

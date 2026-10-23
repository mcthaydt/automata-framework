import type { FieldDef, FieldValueProblem } from './field-types'

const problem = (
  code: FieldValueProblem['code'],
  message: string,
  extra?: { index: number; cause: FieldValueProblem },
): FieldValueProblem => ({ code, message, ...extra })

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

function checkNumber(def: FieldDef, value: unknown): FieldValueProblem | undefined {
  if (!isFiniteNumber(value)) return problem('wrongType', `${def.id} must be a finite number`)
  if (def.type === 'int' && !Number.isInteger(value))
    return problem('notInteger', `${def.id} must be a whole number`)
  if (def.type !== 'angle') {
    if (def.min !== undefined && value < def.min)
      return problem('belowMin', `${def.id} must be at least ${def.min}`)
    if (def.max !== undefined && value > def.max)
      return problem('aboveMax', `${def.id} must be at most ${def.max}`)
  }
  return undefined
}

function checkScalar(def: FieldDef, value: unknown): FieldValueProblem | undefined {
  switch (def.type) {
    case 'int':
    case 'float':
    case 'angle':
      return checkNumber(def, value)
    case 'bool':
      return typeof value === 'boolean' ? undefined : problem('wrongType', `${def.id} must be true or false`)
    case 'text':
      return typeof value === 'string' ? undefined : problem('wrongType', `${def.id} must be text`)
    default:
      return undefined
  }
}

/**
 * Whether `value` fits the field: `undefined` when it does, else the first problem. It checks the value's shape
 * and the field's own rules; whether a reference resolves is the editor's check. Spec §4.8.
 */
export function checkFieldValue(def: FieldDef, value: unknown): FieldValueProblem | undefined {
  return checkScalar(def, value)
}

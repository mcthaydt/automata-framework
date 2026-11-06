// Checks one value against its field definition and says what is wrong in a stable code plus a sentence; a list
// reports the item at fault.
import { type FieldDef, type FieldValueProblem, HEX_COLOR } from './field-types'

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function checkRef(def: FieldDef, value: unknown): FieldValueProblem | undefined {
  const fits =
    isRecord(value) &&
    typeof value.target === 'string' &&
    value.target !== '' &&
    (value.container === undefined || typeof value.container === 'string')
  return fits ? undefined : problem('badRef', `${def.id} must be a reference with a target`)
}

function checkPoint(def: FieldDef, value: unknown): FieldValueProblem | undefined {
  const fits = isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y)
  return fits ? undefined : problem('badPoint', `${def.id} must be a point with a finite x and y`)
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
    case 'enum':
      if (typeof value !== 'string') return problem('wrongType', `${def.id} must be one of its options`)
      return def.options?.includes(value)
        ? undefined
        : problem('notAnOption', `${def.id} has no option "${value}"`)
    case 'color':
      if (typeof value !== 'string') return problem('wrongType', `${def.id} must be a #rrggbb color`)
      return HEX_COLOR.test(value) ? undefined : problem('badColor', `${def.id} must be a #rrggbb color`)
    case 'point':
      return checkPoint(def, value)
    case 'ref':
      return checkRef(def, value)
  }
}

function checkList(def: FieldDef, value: unknown): FieldValueProblem | undefined {
  if (!Array.isArray(value)) return problem('wrongType', `${def.id} must be a list`)
  for (let index = 0; index < value.length; index++) {
    const cause = checkScalar(def, value[index])
    if (cause) return problem('badListItem', `${def.id} item ${index}: ${cause.message}`, { index, cause })
  }
  return undefined
}

/**
 * Whether `value` fits the field: `undefined` when it does, else the first problem. It checks the value's shape
 * and the field's own rules; whether a reference resolves is the editor's check.
 */
export function checkFieldValue(def: FieldDef, value: unknown): FieldValueProblem | undefined {
  return def.list ? checkList(def, value) : checkScalar(def, value)
}

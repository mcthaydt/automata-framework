// Checks a field definition on its own: its id, its type and the limits that type allows (a range, a colour, a token
// name), so a bad definition is refused before any value is checked against it.
import { checkFieldValue } from './check-field-value.ts'
import {
  ENTITY_ID,
  type EntityDef,
  type EntityDefProblem,
  FIELD_ID,
  type FieldDef,
  type FieldDefCode,
  type FieldProblem,
  type FieldValue,
  HEX_COLOR,
} from './field-types.ts'

// Editor Kit token names are `group/name` (`layer/entities`), never a bare word.
const TOKEN_NAME = /^[a-z][a-z0-9-]*(\/[a-z0-9-]+)+$/

const isNumeric = (def: FieldDef): boolean => def.type === 'int' || def.type === 'float'

const clamp = (value: number, min: number | undefined, max: number | undefined): number =>
  Math.min(Math.max(value, min ?? Number.NEGATIVE_INFINITY), max ?? Number.POSITIVE_INFINITY)

function zeroValue(def: FieldDef): FieldValue | undefined {
  switch (def.type) {
    case 'int':
    case 'float':
      return clamp(0, def.min, def.max)
    case 'angle':
      return 0
    case 'bool':
      return false
    case 'text':
      return ''
    case 'enum':
      return def.options?.[0]
    case 'color':
      return '#ffffff'
    case 'point':
      return { x: 0, y: 0 }
    case 'ref':
      return undefined
  }
}

/**
 * The value an instance gets when it has none: the field's `default`, else the type's zero (moved into a number's
 * bounds), else `[]` for a list. `undefined` for a required field, which has no stand-in, and for a ref until one
 * is picked.
 */
export function defaultFieldValue(def: FieldDef): FieldValue | undefined {
  if (def.required) return undefined
  if (def.default !== undefined) return def.default
  return def.list ? [] : zeroValue(def)
}

const problem = (code: FieldDefCode, message: string): FieldProblem<FieldDefCode> => ({ code, message })

/** Properties a field of this type must not carry, in the order `checkFieldDef` reports them. */
function misplacedProperties(def: FieldDef): string[] {
  const misplaced: string[] = []
  if (!isNumeric(def)) {
    if (def.min !== undefined) misplaced.push('min')
    if (def.max !== undefined) misplaced.push('max')
    if (def.step !== undefined) misplaced.push('step')
  }
  if (def.type !== 'enum' && def.options !== undefined) misplaced.push('options')
  if (def.type !== 'ref' && def.to !== undefined) misplaced.push('to')
  if (def.type !== 'text' && def.multiline !== undefined) misplaced.push('multiline')
  return misplaced
}

function boundsProblem(def: FieldDef): FieldProblem<FieldDefCode> | undefined {
  const { min, max } = def
  const finite = (bound: number | undefined): boolean => bound === undefined || Number.isFinite(bound)
  if (!finite(min) || !finite(max))
    return problem('badBounds', `${def.id}: min and max must be finite numbers`)
  if (min !== undefined && max !== undefined && min > max) {
    return problem('badBounds', `${def.id}: min ${min} is above max ${max}`)
  }
  return undefined
}

function optionProblem(def: FieldDef): FieldProblem<FieldDefCode> | undefined {
  if (def.type !== 'enum') return undefined
  if (!def.options || def.options.length === 0)
    return problem('noOptions', `${def.id}: an enum needs options`)
  if (new Set(def.options).size !== def.options.length) {
    return problem('duplicateOption', `${def.id}: options must be unique`)
  }
  return undefined
}

function defaultProblem(def: FieldDef): FieldProblem<FieldDefCode> | undefined {
  if (def.default === undefined) return undefined
  if (def.required) return problem('badDefault', `${def.id}: a required field has no default`)
  const misfit = checkFieldValue(def, def.default)
  return misfit ? problem('badDefault', `${def.id}: the default does not fit: ${misfit.message}`) : undefined
}

/** Problems with one field definition, in a stable order: id, misplaced properties, bounds, step, options, default. */
export function checkFieldDef(def: FieldDef): readonly FieldProblem<FieldDefCode>[] {
  const problems: FieldProblem<FieldDefCode>[] = []
  if (!FIELD_ID.test(def.id)) problems.push(problem('badId', `"${def.id}" is not a field id`))
  for (const property of misplacedProperties(def)) {
    problems.push(
      problem('wrongTypeProperty', `${def.id}: ${property} does not apply to a ${def.type} field`),
    )
  }
  if (isNumeric(def)) {
    const bounds = boundsProblem(def)
    if (bounds) problems.push(bounds)
    if (def.step !== undefined && !(Number.isFinite(def.step) && def.step > 0)) {
      problems.push(problem('badStep', `${def.id}: step must be a positive number`))
    }
  }
  const options = optionProblem(def)
  if (options) problems.push(options)
  const badDefault = defaultProblem(def)
  if (badDefault) problems.push(badDefault)
  return problems
}

/**
 * Problems with an entity definition: its id and color, then each field's problems tagged with the field's id and
 * index, with a repeated field id reported at its later occurrence.
 */
export function checkEntityDef(def: EntityDef): readonly EntityDefProblem[] {
  const problems: EntityDefProblem[] = []
  if (!ENTITY_ID.test(def.id))
    problems.push({ code: 'badEntityId', message: `"${def.id}" is not an entity id` })
  if (def.color !== undefined && !HEX_COLOR.test(def.color) && !TOKEN_NAME.test(def.color)) {
    problems.push({ code: 'badEntityColor', message: `"${def.color}" is neither #rrggbb nor a token name` })
  }
  const seen = new Set<string>()
  def.fields.forEach((field, fieldIndex) => {
    if (seen.has(field.id)) {
      problems.push({
        code: 'duplicateFieldId',
        message: `field id "${field.id}" is used twice`,
        fieldId: field.id,
        fieldIndex,
      })
    }
    seen.add(field.id)
    for (const fieldProblem of checkFieldDef(field))
      problems.push({ ...fieldProblem, fieldId: field.id, fieldIndex })
  })
  return problems
}

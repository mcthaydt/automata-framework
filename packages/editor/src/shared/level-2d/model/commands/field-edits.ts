import type { FieldDef, FieldValues } from '@mcthaydt/automata-content/level-2d'
import { checkFieldDef } from '@mcthaydt/automata-content/level-2d'
import { renameFieldValues, valuesWithDefaults } from '../../../kit/fields/field-values.ts'
import { checkRetype, renameField as renameKitField } from '../../../kit/fields/retype.ts'
import type { Project } from '../project-types'
import type { GuardedEdit } from './def-lookup'
import { type FieldOwner, fieldsOf, mapValues, valueHolders, withFields } from './field-owner'

// Typed field edits on an entity definition or on the level fields.
// A field definition is checked with the kit's `checkFieldDef` and its id must be new to its owner; a problem throws
// `RangeError` with the kit's message, so the field editor shows it and keeps the old definition. A retype that would
// stop existing values validating refuses with the exact instances (`checkRetype`), unless told to go ahead anyway.

function checkDef(def: FieldDef): void {
  const problem = checkFieldDef(def)[0]
  if (problem !== undefined) throw new RangeError(problem.message)
}

function checkIdFree(fields: readonly FieldDef[], id: string, except?: string): void {
  if (fields.some((field) => field.id === id && field.id !== except))
    throw new RangeError(`field id "${id}" is already used`)
}

/** Appends a field; every existing holder gets its stand-in value (`valuesWithDefaults`), a required one none. */
export function addField(project: Project, owner: FieldOwner, def: FieldDef): Project {
  const fields = fieldsOf(project, owner)
  checkDef(def)
  checkIdFree(fields, def.id)
  return mapValues(withFields(project, owner, [...fields, def]), owner, (values) =>
    valuesWithDefaults([def], values),
  )
}

/** The value under `id` taken out, then the field's stand-in put back (nothing for a required field). */
function restart(values: FieldValues, field: FieldDef): FieldValues {
  const { [field.id]: _dropped, ...rest } = values
  return valuesWithDefaults([field], rest)
}

/**
 * Replaces field `id` with `next`: any change to its type, bounds, options, list flag, `required`, default or label,
 * and its id too (values move with it, keeping their place). When some instance's value would stop validating, the
 * result is a refusal listing each one, unless `anyway`, which drops those values and gives each instance the new
 * field's stand-in in the same returned project, so it is one undo step. An instance that failed before the change is
 * not listed and keeps its value: the Checks report it, the retype did not break it.
 */
export function retypeField(
  project: Project,
  owner: FieldOwner,
  id: string,
  next: FieldDef,
  options: { readonly anyway?: boolean } = {},
): GuardedEdit {
  const fields = fieldsOf(project, owner)
  const old = fields.find((field) => field.id === id)
  if (old === undefined) throw new RangeError(`no field "${id}"`)
  checkDef(next)
  checkIdFree(fields, next.id, id)
  if (JSON.stringify(old) === JSON.stringify(next)) return { ok: true, project }
  const holders = valueHolders(project, owner)
  const breakages = checkRetype(old, next, holders)
  if (breakages.length > 0 && options.anyway !== true) {
    const pathOf = new Map(holders.map((holder) => [holder.id, holder.path]))
    return {
      ok: false,
      uses: breakages.map((breakage) => ({
        path: `${pathOf.get(breakage.instanceId)}.fields.${id}`,
        message: breakage.problem.message,
      })),
    }
  }
  const broken = new Set(breakages.map((breakage) => breakage.instanceId))
  const retyped = withFields(
    project,
    owner,
    fields.map((field) => (field === old ? next : field)),
  )
  return {
    ok: true,
    project: mapValues(retyped, owner, (values, holder) => {
      const moved = renameFieldValues(values, id, next.id)
      return broken.has(holder) ? restart(moved, next) : moved
    }),
  }
}

const RENAME_REFUSAL = {
  unknownField: (from: string) => `no field "${from}"`,
  badId: (_from: string, to: string) => `"${to}" is not a field id`,
  duplicateFieldId: (_from: string, to: string) => `field id "${to}" is already used`,
} as const

/**
 * Changes a field's id with the kit's `renameField` and moves every value with it (`renameFieldValues`), keeping each
 * value's place. It never refuses over values: they are the same values under the same rules.
 */
export function renameField(project: Project, owner: FieldOwner, from: string, to: string): Project {
  // The kit renames a field of one definition; the owner's fields stand in as that definition, levels included.
  const fields = fieldsOf(project, owner)
  const renamed = renameKitField({ id: 'level', fields }, from, to)
  if (!renamed.ok) throw new RangeError(RENAME_REFUSAL[renamed.code](from, to))
  if (renamed.def.fields === fields) return project
  return mapValues(withFields(project, owner, renamed.def.fields), owner, (values) =>
    renameFieldValues(values, from, to),
  )
}

// The thing edits (ED3D spec §5.4, ED3D.7a): `thing.add`, `thing.move`, `thing.setField` and `thing.remove`. Each is a
// value the editor runs, written once over the things both formats share; where a thing lives in the file is the
// profile's `ThingAccess`. An edit enforces the rules the `entities` check enforces, in the check's own sentences, so an
// editor that only uses these edits never makes a level the checks call worse. Every number is written to four decimals.
import {
  checkFieldValue,
  checkValues,
  type FieldDef,
  type FieldValue,
  type FieldValues,
} from '@mcthaydt/automata-editor-kit/fields'
import { entitySelection, place } from '../checks/check'
import type { ThingDef } from '../entities/thing-def.schema'
import type { Thing } from '../entities/things'
import { sectorAt } from '../geometry/sectors'
import { GeometryError, type LevelProfile } from '../profile/level-profile'
import { ThingAccessError } from '../profile/thing-access'
import { type Edit, type EditResult, ok, refuse } from './edit'
import { ID_PATTERN, numberProblem, round4 } from './sector-edit-support'

const placeOf = (def: string, id: string): string | undefined =>
  place(() => entitySelection(def, id))?.selection

/** A number as the file writes it, and a list of numbers (a colour) by its parts. A definition has no point field. */
function rounded(value: FieldValue): FieldValue {
  if (typeof value === 'number') return round4(value)
  return Array.isArray(value) ? value.map(rounded) : value
}

/** The thing and its definition, or the sentence for why it cannot be changed: the reader's own for a thing it could not read. */
function lookUp<D>(
  profile: LevelProfile<D>,
  level: D,
  def: string,
  id: string,
): { readonly thing: Thing; readonly definition: ThingDef } | { readonly problem: string } {
  const kit = profile.entities(level)
  const thing = kit.things.find((each) => each.def === def && each.id === id)
  const definition = kit.definitions.find((each) => each.id === def)
  if (thing !== undefined && definition !== undefined) return { thing, definition }
  const unreadable = kit.problems.find((each) => each.entity?.def === def && each.entity.id === id)
  return { problem: unreadable?.message ?? `no ${def} ${id}` }
}

/** The floor under a place, or the sentence for why there is none: outside every sector (a hole is outside), or no level. */
function standing<D>(
  profile: LevelProfile<D>,
  level: D,
  id: string,
  x: number,
  z: number,
): { readonly floor: number } | { readonly problem: string } {
  try {
    for (const layer of profile.geometry(level).layers) {
      const sector = layer.kind === 'sectors' ? sectorAt(layer.map, { x, z }) : undefined
      if (sector !== undefined) return { floor: sector.floor }
    }
  } catch (error) {
    if (error instanceof GeometryError) return { problem: error.message }
    throw error
  }
  return { problem: `entity ${id} is outside every sector` }
}

/** What is wrong with the numbers of a place, in the order a person reads them. */
function placeProblem(x: number, z: number, y: number | undefined): string | undefined {
  return (
    numberProblem('x', x) ?? numberProblem('z', z) ?? (y === undefined ? undefined : numberProblem('y', y))
  )
}

/** A thing that rests on the floor has no height of its own. */
const floorProblem = (definition: ThingDef, y: number | undefined): string | undefined =>
  definition.sit !== 'free' && y !== undefined
    ? `a ${definition.id} rests on the floor and has no height`
    : undefined

/**
 * A refusal when the file could not hold `level` any more (a value the definition accepts but the format does not: a
 * `box:` that is no `box:`), so that an edit never makes a level that cannot be saved.
 */
function fileProblem<D>(profile: LevelProfile<D>, level: D, id: string): string | undefined {
  const parsed = profile.schema.safeParse(level)
  if (parsed.success) return undefined
  const issue = parsed.error.issues[0]
  return `entity ${id}: the file cannot hold it (${issue?.path.join('.') ?? ''}: ${issue?.message ?? 'refused'})`
}

/** The result of asking a profile's access to write: the level, or its sentence when it refuses. */
function written<D>(
  write: () => D,
  at?: string,
): { readonly level: D } | { readonly refused: EditResult<never> } {
  try {
    return { level: write() }
  } catch (error) {
    if (error instanceof ThingAccessError) return { refused: refuse(error.message, at) }
    throw error
  }
}

export interface AddThingArgs {
  readonly def: string
  readonly id: string
  readonly x: number
  readonly z: number
  /** Only for a thing that floats; it defaults to the floor of the sector the thing stands in. */
  readonly y?: number | undefined
  /** The fields; a field with a default of its own is filled in when it is not given. */
  readonly values?: FieldValues | undefined
}

/**
 * The values of a new thing: each field of the definition in its order, as given or else by its own default (a required
 * field has none), then whatever else was given, which the check for the values will refuse. The type's zero is not
 * written for a field with no default: an optional member that nobody set is not in the file.
 */
function startingValues(fields: readonly FieldDef[], given: FieldValues): FieldValues {
  const has = (id: string): boolean => Object.hasOwn(given, id) && given[id] !== undefined
  const known = new Set(fields.map((field) => field.id))
  return Object.fromEntries([
    ...fields.flatMap((field): [string, FieldValue][] => {
      if (has(field.id)) return [[field.id, rounded(given[field.id] as FieldValue)]]
      // A required field has no default: a definition cannot give it one.
      return field.default === undefined ? [] : [[field.id, field.default]]
    }),
    ...Object.entries(given).filter(([id]) => !known.has(id)),
  ])
}

export function addThing<D>(args: AddThingArgs): Edit<D> {
  const { def, id } = args
  return {
    id: 'thing.add',
    label: `Add ${def} ${id}`,
    run(profile, level) {
      const kit = profile.entities(level)
      const definition = kit.definitions.find((each) => each.id === def)
      if (definition === undefined) return refuse(`no definition ${def}`)
      if (!ID_PATTERN.test(id)) return refuse('the id must be an id: a letter, then letters, digits, - or _')
      if (profile.things.takenIds(level, def).includes(id))
        return refuse(`there is already something called ${id}`)
      const first = definition.single ? kit.things.find((each) => each.def === def) : undefined
      if (first !== undefined) return refuse(`${def} allows one: entity ${first.id} is there already`)
      const problem = placeProblem(args.x, args.z, args.y) ?? floorProblem(definition, args.y)
      if (problem !== undefined) return refuse(problem)
      const [x, z] = [round4(args.x), round4(args.z)]
      const under = standing(profile, level, id, x, z)
      if ('problem' in under) return refuse(under.problem)
      const y = definition.sit === 'free' ? round4(args.y ?? under.floor) : undefined
      const values = startingValues(definition.fields, args.values ?? {})
      const misfits = checkValues(definition.fields, values)
      if (misfits.length > 0)
        return refuse(`entity ${id}: ${misfits.map((misfit) => misfit.message).join('; ')}`)
      const thing: Thing = { def, id, x, z, ...(y === undefined ? {} : { y }), values }
      const added = written(() => profile.things.add(level, thing))
      if ('refused' in added) return added.refused
      const refused = fileProblem(profile, added.level, id)
      if (refused !== undefined) return refuse(refused)
      const at = placeOf(def, id)
      return ok(added.level, at === undefined ? undefined : [at])
    },
  }
}

export interface MoveThingArgs {
  readonly def: string
  readonly id: string
  readonly x: number
  readonly z: number
  /** Only for a thing that floats; it keeps its own height when this is not given. */
  readonly y?: number | undefined
}

export function moveThing<D>(args: MoveThingArgs): Edit<D> {
  const { def, id } = args
  return {
    id: 'thing.move',
    label: `Move ${def} ${id}`,
    coalesce: `move:${def}/${id}`,
    run(profile, level) {
      const at = placeOf(def, id)
      const found = lookUp(profile, level, def, id)
      if ('problem' in found) return refuse(found.problem, at)
      const { thing, definition } = found
      const problem = placeProblem(args.x, args.z, args.y) ?? floorProblem(definition, args.y)
      if (problem !== undefined) return refuse(problem, at)
      const [x, z] = [round4(args.x), round4(args.z)]
      const under = standing(profile, level, id, x, z)
      if ('problem' in under) return refuse(under.problem, at)
      const y = args.y === undefined ? thing.y : round4(args.y)
      const moved: Thing = { def, id, x, z, ...(y === undefined ? {} : { y }), values: thing.values }
      const replaced = written(() => profile.things.replace(level, def, id, moved), at)
      return 'refused' in replaced ? replaced.refused : ok(replaced.level)
    },
  }
}

export interface SetThingFieldArgs {
  readonly def: string
  readonly id: string
  readonly field: string
  /** `null` clears the field: it is not in the file any more. */
  readonly value: FieldValue | null
}

export function setThingField<D>(args: SetThingFieldArgs): Edit<D> {
  const { def, id, field } = args
  return {
    id: 'thing.setField',
    label: `Set ${field} of ${id}`,
    coalesce: `field:${def}/${id}/${field}`,
    run(profile, level) {
      const at = placeOf(def, id)
      const found = lookUp(profile, level, def, id)
      if ('problem' in found) return refuse(found.problem, at)
      const { thing, definition } = found
      const fieldDef = definition.fields.find((each) => each.id === field)
      if (fieldDef === undefined) return refuse(`entity ${id}: ${field} is not a field of this entity`, at)
      let values: FieldValues
      if (args.value === null) {
        if (fieldDef.required) return refuse(`entity ${id}: ${field} is required`, at)
        values = Object.fromEntries(Object.entries(thing.values).filter(([name]) => name !== field))
      } else {
        const value = rounded(args.value)
        const misfit = checkFieldValue(fieldDef, value)
        if (misfit !== undefined) return refuse(`entity ${id}: ${misfit.message}`, at)
        // The access keeps the members in the order the file has them, a field it did not have goes last.
        values = { ...thing.values, [field]: value }
      }
      const replaced = written(() => profile.things.replace(level, def, id, { ...thing, values }), at)
      if ('refused' in replaced) return replaced.refused
      if (replaced.level === level) return ok(level)
      const refused = fileProblem(profile, replaced.level, id)
      return refused === undefined ? ok(replaced.level) : refuse(refused, at)
    },
  }
}

export function removeThing<D>(args: { readonly def: string; readonly id: string }): Edit<D> {
  const { def, id } = args
  return {
    id: 'thing.remove',
    label: `Remove ${def} ${id}`,
    run(profile, level) {
      const at = placeOf(def, id)
      // The access answers first, so a thing that is not there is not there, whatever still points at it.
      const removed = written(() => profile.things.remove(level, def, id), at)
      if ('refused' in removed) return removed.refused
      const references = profile.things.references(level, def, id)
      if (references.length > 0)
        return refuse(`${def} ${id} is still referenced: ${references.join('; ')}`, at)
      return ok(removed.level)
    },
  }
}

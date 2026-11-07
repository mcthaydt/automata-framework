// The definition edits (ED3D spec §4.7, §5.4, ED3D.13a): `def.add`, `def.rename`, `def.setField` and `def.remove`. Each
// is written once over the profile's `DefinitionAccess`; a profile without one (Last Light) has fixed definitions, and
// every edit refuses on it. A definitions edit never makes a valid instance invalid: a changed field asks the kit's
// `checkRetype`, an added or removed field asks the kit's `checkValues` of the instances that validated before, and a
// ref field's narrowed `to` asks the `ids` check's ref rule. The sentences are the reader's and the checks' own.
import { checkRetype, checkValues, ENTITY_ID, type FieldDef } from '@automata/editor/kit/fields'
import { entityRefProblems } from '../checks/entity-refs'
import type { ThingDef } from '../entities/thing-def.schema'
import { type EntityKit, readEntityKit, type Thing } from '../entities/things'
import type { DefinitionAccess } from '../profile/definition-access'
import type { LevelProfile } from '../profile/level-profile'
import { type Edit, type EditResult, ok, refuse } from './edit'

const SECTOR = '$sector'
const FIXED = "this level's entity definitions are fixed by its format"
const BAD_ID = 'the definition id must be an id: a lowercase letter, then lowercase letters, digits or -'

/** A definition found readable, or the sentence for why it cannot be changed: the reader's own for one it could not read. */
function lookUp<D>(
  profile: LevelProfile<D>,
  access: DefinitionAccess<D>,
  level: D,
  def: string,
): { readonly definition: ThingDef; readonly kit: EntityKit } | { readonly problem: string } {
  const kit = profile.entities(level)
  const definition = kit.definitions.find((each) => each.id === def)
  if (definition !== undefined) return { definition, kit }
  const index = access.ids(level).indexOf(def)
  const unreadable =
    index < 0
      ? undefined
      : kit.problems.find((each) => each.path[0] === 'entityDefs' && each.path[1] === index)
  return { problem: unreadable?.message ?? `no entity definition ${def}` }
}

/** The reader's first sentence about a definition, or nothing when it reads: the rules are the kit's and the 3D editor's. */
function ruleProblem(definition: ThingDef): string | undefined {
  return readEntityKit({ definitions: [{ path: [], value: definition }], instances: [] }).problems[0]?.message
}

/** The `ids` check's sentence for a ref field that may point at what is no definition, `known` being the ids there are. */
function toProblem(definition: ThingDef, known: ReadonlySet<string>): string | undefined {
  for (const field of definition.fields)
    for (const name of field.to ?? [])
      if (name !== SECTOR && name !== definition.id && !known.has(name))
        return `entity definition ${definition.id}: ${field.id} may point at ${name}, which is not a definition or $sector`
  return undefined
}

/** What is wrong with a definition an edit is about to write, in the order a person fixes it. */
function definitionProblem(definition: ThingDef, known: ReadonlySet<string>): string | undefined {
  return ruleProblem(definition) ?? toProblem(definition, known)
}

/** The edit's answer when the profile's definitions are fixed, or the access to write them. */
function accessOf<D>(profile: LevelProfile<D>): DefinitionAccess<D> | EditResult<never> {
  return profile.definitions ?? refuse(FIXED)
}

const isAccess = <D>(value: DefinitionAccess<D> | EditResult<never>): value is DefinitionAccess<D> =>
  !('ok' in value)

export function addDefinition<D>(args: { readonly definition: ThingDef }): Edit<D> {
  const { definition } = args
  return {
    id: 'def.add',
    label: `Add definition ${definition.id}`,
    run(profile, level) {
      const access = accessOf(profile)
      if (!isAccess(access)) return access
      if (!ENTITY_ID.test(definition.id)) return refuse(BAD_ID)
      const ids = access.ids(level)
      if (ids.includes(definition.id)) return refuse(`there is already a definition called ${definition.id}`)
      const problem = definitionProblem(definition, new Set(ids))
      return problem === undefined ? ok(access.add(level, definition)) : refuse(problem)
    },
  }
}

export function renameDefinition<D>(args: { readonly def: string; readonly to: string }): Edit<D> {
  const { def, to } = args
  return {
    id: 'def.rename',
    label: `Rename definition ${def} to ${to}`,
    run(profile, level) {
      const access = accessOf(profile)
      if (!isAccess(access)) return access
      const found = lookUp(profile, access, level, def)
      if ('problem' in found) return refuse(found.problem)
      if (to === def) return ok(level)
      if (!ENTITY_ID.test(to)) return refuse(BAD_ID)
      if (access.ids(level).includes(to)) return refuse(`there is already a definition called ${to}`)
      // The definition itself, then every ref field that may point at it (its own included, and those of definitions
      // the reader could not read), then its instances.
      const renamed = access.replace(level, def, { ...found.definition, id: to })
      return ok(access.renameInstances(access.retarget(renamed, def, to), def, { def: to }))
    },
  }
}

export interface SetDefinitionFieldArgs {
  readonly def: string
  /** The id of the field to change or remove; absent adds `value` as a new field at the end. */
  readonly field?: string | undefined
  /** The field as it is to be (its id may differ: a rename); `null` removes the field. */
  readonly value: FieldDef | null
}

const holds = (thing: Thing, id: string): boolean =>
  Object.hasOwn(thing.values, id) && thing.values[id] !== undefined

/** The instances of `definition` that validate as they are: only these can be broken by an edit. */
const validInstances = (kit: EntityKit, definition: ThingDef): Thing[] =>
  kit.things.filter(
    (thing) => thing.def === definition.id && checkValues(definition.fields, thing.values).length === 0,
  )

/** The sentences for what a field change would break, before it is written: the kit's rules over the instances. */
function valueBreakages(
  kit: EntityKit,
  definition: ThingDef,
  old: FieldDef | undefined,
  value: FieldDef | null,
): string[] {
  const valid = validInstances(kit, definition)
  if (value === null)
    return valid
      .filter((thing) => old !== undefined && holds(thing, old.id))
      .map((thing) => `entity ${thing.id} holds a value for it`)
  if (old !== undefined)
    return checkRetype(old, value, valid).map(
      (breakage) => `entity ${breakage.instanceId}: ${breakage.problem.message}`,
    )
  return valid.flatMap((thing) =>
    checkValues([value], thing.values)
      .filter((problem) => problem.fieldId === value.id)
      .map((problem) => `entity ${thing.id}: ${problem.message}`),
  )
}

/** The fields of `definition` with `old` changed to `value` in its place, removed (`null`), or `value` added at the end. */
function fieldsWith(definition: ThingDef, old: FieldDef | undefined, value: FieldDef | null): FieldDef[] {
  const added = value === null ? [] : [value]
  if (old === undefined) return [...definition.fields, ...added]
  return definition.fields.flatMap((field) => (field === old ? added : [field]))
}

/** The level with the field of `definition` set: the definition replaced, and the instances' member renamed with it. */
function withField<D>(
  access: DefinitionAccess<D>,
  level: D,
  definition: ThingDef,
  old: FieldDef | undefined,
  value: FieldDef | null,
): D {
  const next = access.replace(level, definition.id, {
    ...definition,
    fields: fieldsWith(definition, old, value),
  })
  if (old === undefined || value === null || value.id === old.id) return next
  return access.renameInstances(next, definition.id, { field: { from: old.id, to: value.id } })
}

/** The ref check's sentences about the instances of `def`, in the level a profile answers for. */
function refSentences<D>(profile: LevelProfile<D>, level: D, def: string): Set<string> {
  const kit = profile.entities(level)
  const sectorIds = profile.sectors.list(level).map((sector) => sector.id)
  const ids = new Set(kit.things.filter((thing) => thing.def === def).map((thing) => `entity ${thing.id}: `))
  return new Set(
    entityRefProblems(kit, sectorIds)
      .map((problem) => problem.message)
      .filter((message) => [...ids].some((prefix) => message.startsWith(prefix))),
  )
}

export function setDefinitionField<D>(args: SetDefinitionFieldArgs): Edit<D> {
  const { def, field, value } = args
  const name = field ?? value?.id ?? ''
  return {
    id: 'def.setField',
    label: value === null ? `Remove field ${name} of ${def}` : `Set field ${name} of ${def}`,
    run(profile, level) {
      const access = accessOf(profile)
      if (!isAccess(access)) return access
      const found = lookUp(profile, access, level, def)
      if ('problem' in found) return refuse(found.problem)
      const { definition, kit } = found
      const old = field === undefined ? undefined : definition.fields.find((each) => each.id === field)
      if (field !== undefined && old === undefined) return refuse(`${def} has no field ${field}`)
      if (old === undefined && value === null) return refuse('a field to remove is named by its id')
      if (value !== null && value.id !== old?.id && definition.fields.some((each) => each.id === value.id))
        return refuse(`${def} already has a field ${value.id}`)
      const next = withField(access, level, definition, old, value)
      if (next === level) return ok(level)
      // A removal is checked too: a box without a size cannot lose one of its w, h and d.
      const fields = fieldsWith(definition, old, value)
      const problem = definitionProblem({ ...definition, fields }, new Set(access.ids(level)))
      if (problem !== undefined) return refuse(problem)
      const broken = valueBreakages(kit, definition, old, value)
      if (value?.type === 'ref' && broken.length === 0) {
        // A rename alone never breaks a ref, so the ref sentences are compared with the level that only renames.
        const renamedOnly =
          old === undefined ? level : withField(access, level, definition, old, { ...old, id: value.id })
        const before = refSentences(profile, renamedOnly, def)
        broken.push(...[...refSentences(profile, next, def)].filter((sentence) => !before.has(sentence)))
      }
      if (broken.length > 0) return refuse(`${def}: ${name} would stop validating: ${broken.join('; ')}`)
      return ok(next)
    },
  }
}

export function removeDefinition<D>(args: { readonly def: string }): Edit<D> {
  const { def } = args
  return {
    id: 'def.remove',
    label: `Remove definition ${def}`,
    run(profile, level) {
      const access = accessOf(profile)
      if (!isAccess(access)) return access
      if (!access.ids(level).includes(def)) return refuse(`no entity definition ${def}`)
      const kit = profile.entities(level)
      // An instance the reader could not read still names the definition, so it is a use too.
      const instances = [
        ...kit.things.filter((thing) => thing.def === def).map((thing) => thing.id),
        ...kit.problems.flatMap((problem) => (problem.entity?.def === def ? [problem.entity.id] : [])),
      ]
      const uses = [
        ...[...new Set(instances)].map((id) => `entity ${id}`),
        // A definition's own ref field may point at itself; it goes with it.
        ...access
          .pointersTo(level, def)
          .filter((pointer) => pointer.def !== def)
          .map((pointer) => `entity definition ${pointer.def}: ${pointer.field} may point at ${def}`),
      ]
      if (uses.length > 0) return refuse(`${def} is still used: ${uses.join('; ')}`)
      return ok(access.remove(level, def))
    },
  }
}

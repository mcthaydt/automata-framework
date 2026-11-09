// The ref half of the `ids` check (ED3D spec §7): a `ref` field must point at a thing or a sector the level has, as its
// `to` allows, and a `to` must name only what can exist: a definition of the file or `$sector`. A level is one file, so
// a ref's `container` is not looked at. Whether a value is shaped like a ref at all is the entity check's to say.
import type { FieldDef } from '@automata/editor/kit/fields'
import { refsOf } from '../things/thing-refs'
import type { EntityKit, Thing } from '../things/things'
import type { Problem } from './check'
import { thingLocator } from './entity-locator'

const SECTOR = '$sector'

/** The sentence's name for what a ref may point at: `crate`, `crate or sector`, `crate, lamp or sector`. */
function allowedName(allowed: readonly string[]): string {
  if (allowed.length === 0) return 'thing or sector'
  const names = allowed.map((name) => (name === SECTOR ? 'sector' : name))
  const last = names.at(-1)
  return names.length === 1 ? `${last}` : `${names.slice(0, -1).join(', ')} or ${last}`
}

/** The ids of what a level has to point at: its things by definition, and its sectors. */
function targetsOf(kit: EntityKit, sectorIds: readonly string[]) {
  // A thing the reader could not read is still there, with its own problem: pointing at it is not a dangling ref.
  const things = new Set<string>()
  const byDefinition = new Map<string, Set<string>>()
  const known = (def: string, id: string): void => {
    things.add(id)
    byDefinition.set(def, (byDefinition.get(def) ?? new Set<string>()).add(id))
  }
  for (const thing of kit.things) known(thing.def, thing.id)
  for (const { entity } of kit.problems) if (entity !== undefined) known(entity.def, entity.id)
  const sectors = new Set(sectorIds)
  return (allowed: readonly string[], target: string): boolean =>
    allowed.length === 0
      ? things.has(target) || sectors.has(target)
      : allowed.some((name) => (name === SECTOR ? sectors.has(target) : byDefinition.get(name)?.has(target)))
}

/** The ref problems of one thing: each item of each ref field that points at nothing, fields in definition order. */
function thingProblems(
  thing: Thing,
  fields: readonly FieldDef[],
  resolves: (allowed: readonly string[], target: string) => boolean,
): Problem[] {
  return refsOf(thing, fields).flatMap(({ which, target, to }) =>
    resolves(to, target)
      ? []
      : [
          {
            message: `entity ${thing.id}: ${which} points at ${target}, which is no ${allowedName(to)}`,
            locator: thingLocator(thing),
          },
        ],
  )
}

/**
 * The ref fields that point at nothing, and the `to` lists that name nothing. A definition's problem comes first, once
 * and without a place (a definition cannot be selected); then each thing's in file order. Things the reader could
 * not read are not looked at.
 */
export function entityRefProblems(kit: EntityKit, sectorIds: readonly string[]): Problem[] {
  const problems: Problem[] = []
  const defined = new Set(kit.definitions.map((def) => def.id))
  for (const def of kit.definitions)
    for (const field of def.fields)
      for (const name of field.to ?? [])
        if (name !== SECTOR && !defined.has(name))
          problems.push({
            message: `entity definition ${def.id}: ${field.id} may point at ${name}, which is not a definition or $sector`,
          })
  const resolves = targetsOf(kit, sectorIds)
  const definitions = new Map(kit.definitions.map((def) => [def.id, def]))
  for (const thing of kit.things) {
    const def = definitions.get(thing.def)
    if (def !== undefined) problems.push(...thingProblems(thing, def.fields, resolves))
  }
  return problems
}

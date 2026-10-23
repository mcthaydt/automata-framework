// The entity check (ED3D spec §7, `entities`): what is wrong with the things of a level, whatever its format. It reads the
// kit a profile answers (ED3D.1b2) and the sectors the level resolves to. A thing breaks it when its definition is not
// defined or its members could not be read, when a value does not fit its field (or a required one is missing), when it
// stands outside every sector, or when it is a second of a `single` definition. Each problem names the entity and says
// where it is, so Locate can frame it.
import { checkValues } from '@mcthaydt/automata-editor-kit/fields'
import type { EntityKit, EntityRef, Thing } from '../entities/things'
import { type ResolvedMap, sectorAt } from '../geometry/sectors'
import { entitySelection, type Locator, locators, type Problem, place } from './check'

const locatorOf = ({ def, id, at }: EntityRef): Locator | undefined =>
  place(() => entitySelection(def, id), at)

const refOf = (thing: Thing): EntityRef => ({ def: thing.def, id: thing.id, at: { x: thing.x, z: thing.z } })

/**
 * In this order: what the reader could not read (definitions first, then instances), then for each thing in file order
 * its value problems and whether it stands in a sector, then each `single` definition's second and later things.
 */
export function entityProblems(kit: EntityKit, map: ResolvedMap): Problem[] {
  const problems: Problem[] = []
  for (const read of kit.problems)
    problems.push({ message: read.message, locator: read.entity && locatorOf(read.entity) })
  const definitions = new Map(kit.definitions.map((def) => [def.id, def]))
  for (const thing of kit.things) {
    const locator = locatorOf(refOf(thing))
    const def = definitions.get(thing.def)
    if (def === undefined) continue
    for (const problem of checkValues(def.fields, thing.values))
      problems.push({ message: `entity ${thing.id}: ${problem.message}`, locator })
    if (sectorAt(map, { x: thing.x, z: thing.z }) === undefined)
      problems.push({ message: `entity ${thing.id} is outside every sector`, locator })
  }
  for (const def of kit.definitions) {
    if (!def.single) continue
    const [first, ...others] = kit.things.filter((thing) => thing.def === def.id)
    if (first === undefined) continue
    for (const other of others)
      problems.push({
        message: `${def.id} allows one: entity ${other.id} is another`,
        locator: locatorOf(refOf(other)),
        related: locators(locatorOf(refOf(first))),
      })
  }
  return problems
}

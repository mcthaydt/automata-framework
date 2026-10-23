// The checks of an `af-sector/1` level, as Last Light's are run over a blockout: names are unique, and then the generic
// checks over the sectors the level builds. The order and the early-outs are Last Light's: a level that cannot be
// built answers `build` alone (Last Light's `expand`), one whose portals name a sector that is not there answers `ids`
// and `rooms`, and anything else runs every check, the `entities` check last (ED3D.1b2's kit, ED3D.2b-1).

import {
  type CheckResult,
  checkResult,
  entitySelection,
  type Locator,
  locators,
  type Problem,
  place,
  sectorSelection,
} from '../../checks/check'
import { entityProblems } from '../../checks/entities'
import { genericChecks } from '../../checks/generic-checks'
import { roomsProblem } from '../../checks/rooms-problem'
import { wallLocator } from '../../checks/wall-locator'
import type { AfSector } from '../../format/af-sector.schema'
import type { SectorDef } from '../../format/expand'
import { type ResolvedMap, resolveMap } from '../../geometry/sectors'
import { afEntityKit } from './af-entities'
import { AfBuildError, buildSectors } from './build'

/** Each kind of thing has a name once; entity ids are unique across the file, whatever their definition. */
export function afIdProblems(level: AfSector): Problem[] {
  const problems: Problem[] = []
  // The sentence is said at the second use, and located there with the first beside it.
  const unique = (kind: string, items: readonly { id: string; locator: Locator | undefined }[]): void => {
    const seen = new Map<string, Locator | undefined>()
    for (const { id, locator } of items) {
      if (seen.has(id))
        problems.push({ message: `${kind} ${id} twice`, locator, related: locators(seen.get(id)) })
      else seen.set(id, locator)
    }
  }
  unique(
    'sector',
    level.sectors.map((sector) => {
      const [x, z] = sector.corners[0] ?? [0, 0]
      return { id: sector.id, locator: place(() => sectorSelection(sector.id), { x, z }) }
    }),
  )
  // A definition is not selectable, so its problem has no place.
  const definitions = new Set<string>()
  for (const { id } of level.entityDefs ?? []) {
    if (definitions.has(id)) problems.push({ message: `entity definition ${id} twice` })
    else definitions.add(id)
  }
  unique(
    'entity',
    (level.entities ?? []).map((entity) => ({
      id: entity.id,
      locator: place(() => entitySelection(entity.def, entity.id), { x: entity.x, z: entity.z }),
    })),
  )
  // A sentence is said once, where it first was.
  const said = new Set<string>()
  return problems.filter((found) => !said.has(found.message) && !!said.add(found.message))
}

export function afSectorChecks(level: AfSector): CheckResult[] {
  let sectors: SectorDef[]
  try {
    sectors = buildSectors(level)
  } catch (error) {
    if (error instanceof AfBuildError) return [checkResult('build', [{ message: error.message }])]
    throw error
  }
  const ids = checkResult('ids', afIdProblems(level))
  let map: ResolvedMap
  try {
    map = resolveMap(sectors)
  } catch (error) {
    return [ids, checkResult('rooms', [roomsProblem(error)])]
  }
  const kit = afEntityKit(level)
  const entities = checkResult('entities', entityProblems(kit, map), {
    ok: `${kit.things.length} things of ${kit.definitions.length} definitions`,
  })
  return [ids, ...genericChecks({ map, wall: wallLocator(level.sectors) }), entities]
}

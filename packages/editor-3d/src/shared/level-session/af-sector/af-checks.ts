// The checks of an `af-sector/2` level, as Last Light's are run over a blockout: names are unique and refs resolve, and
// then the generic checks over the sectors the level builds. The order and the early-outs are Last Light's: a level that cannot be
// built answers `build` alone (Last Light's `expand`), one whose portals name a sector that is not there answers `ids`
// and `rooms`, and anything else runs every check, the `entities` and `materials` checks last (ED3D.1b2's kit,
// ED3D.2b).

import type { AfSector2File, SectorDef } from '@automata/3d/level'
import { hasSwatch, isFault, resolveProp } from '@automata/3d/world-content'
import { fileTitle } from '@automata/editor/suite'
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
import { entityRefProblems } from '../../checks/entity-refs'
import { genericChecks } from '../../checks/generic-checks'
import { materialProblems } from '../../checks/materials'
import { roomsProblem } from '../../checks/rooms-problem'
import { wallLocator } from '../../checks/wall-locator'
import { type ResolvedMap, resolveMap, sectorAt } from '../../geometry/sectors'
import { EMPTY_LIBRARY, type GameLibrary, worldLibrary } from '../game-library'
import { afEntityKit } from './af-entities'
import { isPlacedDefinition, placedThings } from './af-placed'
import { AfBuildError, buildSectors } from './build'

/**
 * Each kind of thing has a name once (entity ids are unique across the file, whatever their definition), and then every
 * ref field points at a thing or a sector the file has.
 */
export function afIdProblems(level: AfSector2File): Problem[] {
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
  problems.push(
    ...entityRefProblems(
      afEntityKit(level),
      level.sectors.map((sector) => sector.id),
    ),
  )
  // A sentence is said once, where it first was.
  const said = new Set<string>()
  return problems.filter((found) => !said.has(found.message) && !!said.add(found.message))
}

/** What a name the game lacks is told in: the room, the thing and the way out. */
const missingMaterial = (room: string, _field: string, name: string): string =>
  `The room "${room}" uses a material called "${name}", but the game has none. Choose another with Change materials.`

/**
 * The names the level uses that the game does not have, by core's own rules (`resolveProp`, `hasSwatch`, which accepts a
 * seeded name such as `rust#2`), so the editor and the game never disagree; a character is checked against the game's
 * figures. The records of the game that did not parse are named too. A game with no library asks nothing.
 */
export function libraryProblems(level: AfSector2File, library: GameLibrary): Problem[] {
  if (!library.found) return []
  const problems: Problem[] = library.problems.map((message) => ({ message }))
  const known = worldLibrary(library)
  for (const place of level.props ?? []) {
    const found = resolveProp(place, known)
    if (!isFault(found)) continue
    const locator = placeLocator(propDefinition(place), place.id, place.at)
    problems.push({
      message:
        found.code === 'unknown-prop'
          ? `The room has furniture called "${found.name}", but the game has none. Remove it, or add it to the game.`
          : `The room has furniture that needs a kind of shape the game can't make ("${found.name}"). Remove it, or change it in the game.`,
      locator,
    })
  }
  for (const place of level.cast ?? [])
    if (!library.figures.includes(place.who))
      problems.push({
        message: `The room has a character called "${place.who}", but the game has none. Remove it, or add it in Characters.`,
        locator: placeLocator(`cast.${place.who}`, place.id, place.at),
      })
  return problems
}

const propDefinition = (place: {
  readonly use?: string | undefined
  readonly kind?: string | undefined
}): string => (place.use !== undefined ? `prop.${place.use}` : `kind.${place.kind ?? ''}`)

function placeLocator(def: string, id: string, at: readonly number[]): Locator | undefined {
  const [x = 0, z = 0] = at
  return place(() => entitySelection(def, id), { x, z })
}

/** How close to a wall's line a lamp may stand before it is in the wall, in metres. */
const IN_WALL = 0.05

/** The distance from a point to the segment `a`-`b`. */
function distanceToSegment(
  p: { readonly x: number; readonly z: number },
  a: readonly unknown[],
  b: readonly unknown[],
): number {
  const [ax = 0, az = 0] = a as readonly number[]
  const [bx = 0, bz = 0] = b as readonly number[]
  const dx = bx - ax
  const dz = bz - az
  const length = dx * dx + dz * dz
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.z - az) * dz) / length))
  return Math.hypot(p.x - (ax + t * dx), p.z - (az + t * dz))
}

/** What a placed thing is called in a sentence: `crate`, `pendant lamp`, `character wick`. */
const nounOf = (def: string): string =>
  def.startsWith('cast.')
    ? `character ${def.slice(5)}`
    : def.startsWith('lamp.')
      ? `${def.slice(5)} lamp`
      : def.replace(/^(?:prop|kind)\./, '')

/**
 * Where the furniture, characters and lamps stand, in words: outside every room (the engine's own sentence for a
 * level's own things stays as it was), and a lamp in a wall, which would light nothing a person could see.
 */
export function placedProblems(level: AfSector2File, map: ResolvedMap): Problem[] {
  const problems: Problem[] = []
  for (const thing of placedThings(level)) {
    const locator = place(() => entitySelection(thing.def, thing.id), { x: thing.x, z: thing.z })
    const noun = nounOf(thing.def)
    const inWall =
      thing.def.startsWith('lamp.') &&
      level.sectors.some((sector) =>
        sector.corners.some((corner, index) => {
          const next = sector.corners[(index + 1) % sector.corners.length]
          return next !== undefined && distanceToSegment(thing, corner, next) <= IN_WALL
        }),
      )
    if (inWall)
      problems.push({
        message: `The ${noun} "${thing.id}" is inside a wall. Move it into the room.`,
        locator,
      })
    else if (sectorAt(map, { x: thing.x, z: thing.z }) === undefined)
      problems.push({
        message: `The ${noun} "${thing.id}" stands outside every room. Move it into a room, or remove it.`,
        locator,
      })
  }
  return problems
}

export function afSectorChecks(level: AfSector2File, library: GameLibrary = EMPTY_LIBRARY): CheckResult[] {
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
  const kit = afEntityKit(level, library)
  // The things the game gives are checked for where they stand in words (`placedProblems`), the level's own as ever.
  const own = { ...kit, things: kit.things.filter((thing) => !isPlacedDefinition(thing.def)) }
  const entities = checkResult('entities', [...entityProblems(own, map), ...placedProblems(level, map)], {
    ok: `${kit.things.length} things of ${kit.definitions.length} definitions`,
  })
  const wall = wallLocator(level.sectors)
  const table = level.materials === undefined ? null : Object.keys(level.materials)
  // With the game's swatches, a name is known when the table or the game has it; without them only the table counts.
  const game = library.swatches.size > 0 ? worldLibrary(library) : undefined
  const materials = checkResult(
    'materials',
    table === null && game === undefined
      ? []
      : game === undefined
        ? materialProblems({ map, wall }, new Set(table))
        : materialProblems(
            { map, wall },
            { has: (name) => table?.includes(name) === true || hasSwatch(game, name) },
            missingMaterial,
          ),
    {
      ok:
        game !== undefined
          ? `within the ${library.swatches.size} materials of the game`
          : table === null
            ? 'no materials table'
            : `within the table of ${table.length} materials`,
    },
  )
  // Only a game with a library has names to check; without one the checks are the ones a level has on its own.
  const names = library.found
    ? [
        checkResult('library', libraryProblems(level, library), {
          ok: 'the furniture and characters are in the game',
        }),
      ]
    : []
  return [ids, ...genericChecks({ map, wall }), entities, materials, ...names]
}

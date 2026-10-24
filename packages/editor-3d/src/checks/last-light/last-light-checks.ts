// The Last Light checks as one run over a blockout: Last Light's `validate` (scripts/pipeline/blockout-lib.ts, 92e6704)
// with each problem located, and the checks that are new here (`overlap`, `heights`, then `entities`, `materials`, `lamps`
// and `policy`). Its order and short-circuits are kept: a document that does not expand answers `expand` alone, one
// whose portals name a room that is not there answers `ids` and `rooms`, and anything else runs every check.
import type { Blockout } from '../../format/blockout.schema'
import { BlockoutError, type Expanded, expand } from '../../format/expand'
import { type ResolvedMap, resolveMap } from '../../geometry/sectors'
import { lastLightEntityKit } from '../../profile/last-light-entities'
import type { ProfileContext } from '../../profile/level-profile'
import { type CheckResult, checkResult } from '../check'
import { entityProblems } from '../entities'
import { genericChecks } from '../generic-checks'
import { materialProblems } from '../materials'
import { roomsProblem } from '../rooms-problem'
import { wallLocator } from '../wall-locator'
import { doorProblems } from './doors'
import { idProblems } from './ids'
import { DEFAULT_TONE, lampProblems } from './lamps'
import { navProblems } from './nav-problems'
import { puzzleHotspotProblems } from './puzzle-hotspots'
import { type RoomPolicy, roomPolicyProblems } from './room-policy'

/** What Last Light's checks are told about the game: the profile context, which lists what each check may take. */
export type LastLightOptions = ProfileContext

export function lastLightChecks(blockout: Blockout, options: LastLightOptions = {}): CheckResult[] {
  let expanded: Expanded
  try {
    expanded = expand(blockout)
  } catch (error) {
    if (error instanceof BlockoutError) return [checkResult('expand', [{ message: error.message }])]
    throw error
  }
  const ids = checkResult('ids', idProblems(blockout, expanded))
  let map: ResolvedMap
  try {
    map = resolveMap(expanded.sectors, expanded.masses)
  } catch (error) {
    return [ids, checkResult('rooms', [roomsProblem(error)])]
  }
  const wall = wallLocator(blockout.rooms)
  const [sharedWalls, portals, overlap, heights] = genericChecks({ map, wall })
  // Last Light's `openings` is the portals and then the doors, in one result.
  const openings = checkResult('openings', [...portals.problems, ...doorProblems(blockout, expanded)])
  const wanted = options.puzzleHotspots ?? null
  const puzzle = checkResult('puzzle-hotspots', puzzleHotspotProblems(expanded, wanted), {
    ok: wanted === null ? 'no puzzle.ts' : `${wanted.length} placed`,
  })
  const nav = checkResult('nav', navProblems(blockout, expanded, map), {
    ok: `${Object.keys(expanded.nodes).length} nodes, ${expanded.edges.length} edges clear; ${expanded.hotspots.length} hotspots reachable`,
  })
  const kit = lastLightEntityKit(blockout)
  const entities = checkResult('entities', entityProblems(kit, map), {
    ok: `${kit.things.length} things of ${kit.definitions.length} definitions`,
  })
  const listed = options.materials ?? null
  const materials = checkResult(
    'materials',
    listed === null ? [] : materialProblems({ map, wall }, new Set(listed)),
    { ok: listed === null ? 'no material list' : `within the list of ${listed.length} materials` },
  )
  const kinds = options.lampKinds ?? null
  const kindList = kinds !== null && Object.keys(kinds).length > 0 ? kinds : null
  const kinded = blockout.lamps.filter((lamp) => lamp.kind !== undefined).length
  const lamps = checkResult(
    'lamps',
    kindList === null ? [] : lampProblems(blockout.lamps, kindList, options.tone ?? DEFAULT_TONE),
    {
      ok:
        kindList === null
          ? 'no lamp kinds'
          : `lamps within their archetypes: ${kinded} of ${blockout.lamps.length} have a kind`,
    },
  )
  const policy = policyResult(options.roomPolicy, expanded)
  return [ids, sharedWalls, openings, overlap, heights, puzzle, nav, entities, materials, lamps, policy]
}

const counted = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`

/**
 * The game's own validator throws, so a bad policy stops its stage; here it is a warning, as the level file itself is
 * sound. A game with no policy skips the check; one whose policy the host could not read says so.
 */
function policyResult(roomPolicy: RoomPolicy | null | undefined, expanded: Expanded): CheckResult {
  if (roomPolicy === undefined)
    return checkResult('policy', [], { severity: 'warning', ok: 'no room policy' })
  if (roomPolicy === null)
    return checkResult('policy', [{ message: 'the room policy could not be read' }], { severity: 'warning' })
  const problems = roomPolicyProblems(
    roomPolicy,
    expanded.sectors.map((sector) => sector.id),
    expanded.zones.map((zone) => zone.id),
    expanded.masses.length,
  )
  const [rooms, sectors, zones, masses] = [
    Object.keys(roomPolicy.rooms).length,
    expanded.sectors.length,
    expanded.zones.length,
    expanded.masses.length,
  ]
  return checkResult('policy', problems, {
    severity: 'warning',
    ok: `${counted(rooms, 'room')} for ${counted(sectors, 'sector')}, ${counted(zones, 'zone')} and ${counted(masses, 'mass', 'masses')}`,
  })
}

// The Last Light checks as one run over a blockout: Last Light's `validate` (scripts/pipeline/blockout-lib.ts, 92e6704)
// with each problem located, and the generic checks that are new here after its own. Its order and short-circuits are
// kept: a document that does not expand answers `expand` alone, one whose portals name a room that is not there answers
// `ids` and `rooms`, and anything else runs every check.
import type { Blockout } from '../../format/blockout.schema'
import { BlockoutError, type Expanded, expand } from '../../format/expand'
import { type ResolvedMap, resolveMap } from '../../geometry/sectors'
import { type CheckResult, checkResult, type Problem, place, sectorSelection } from '../check'
import { genericChecks } from '../generic-checks'
import { idProblems } from './ids'
import { wallLocator } from './wall-locator'

/** The room a resolve error is about, when it says (`hall: unknown portal target counter`). */
function roomsProblem(error: unknown): Problem {
  const message = error instanceof Error ? error.message : String(error)
  const room = /^(.+): unknown portal target /.exec(message)?.[1]
  return { message, locator: room === undefined ? undefined : place(() => sectorSelection(room)) }
}

export function lastLightChecks(blockout: Blockout): CheckResult[] {
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
  return [ids, ...genericChecks({ map, wall: wallLocator(blockout) })]
}

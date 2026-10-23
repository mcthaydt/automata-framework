// The checks that need no profile: they read only a level's resolved sectors (ED3D spec §7, the generic checks that
// do not need a definition or a material list). `openings` here holds the portal half; a profile's own opening rules
// (Last Light's door boxes) join the result it returns.
import { type CheckResult, checkResult, type GeometryContext } from './check'
import { heightProblems } from './heights'
import { overlapProblems } from './overlap'
import { portalProblems } from './portals'
import { sharedWallProblems } from './shared-walls'

export function genericChecks(context: GeometryContext): CheckResult[] {
  return [
    checkResult('shared-walls', sharedWallProblems(context)),
    checkResult('openings', portalProblems(context)),
    checkResult('overlap', overlapProblems(context)),
    checkResult('heights', heightProblems(context)),
  ]
}

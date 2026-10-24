// The checks of a `facility.json` that need nothing but the facility (ED3D.9b, ED3D spec §5.3 flow 7): every name a wing,
// a phase, a join or a lock uses resolves, and the lists agree about the same fact. The sentences are ours (Last Light's
// own facility lint is not vendored); each problem is at the World member it is about, as a selection id.
import type { Facility } from '../../format/facility.schema'
import {
  type CheckResult,
  checkResult,
  type FacilitySelectionKind,
  facilitySelection,
  type Locator,
  locators,
  type Problem,
  place,
} from '../check'
import { joinSideProblem, lockProblem, sameJoinSide } from './facility-rules'

/** The results in the order they are run. */
export type FacilityResults = readonly [
  ids: CheckResult,
  wings: CheckResult,
  phases: CheckResult,
  joins: CheckResult,
  locks: CheckResult,
  street: CheckResult,
  notes: CheckResult,
]

/** Where a member of the facility is; a member whose id cannot be selected has no place. */
const locatorOf = (kind: FacilitySelectionKind, id: string): Locator | undefined =>
  place(() => facilitySelection(kind, id))

/** A problem at a member of the facility; a member whose id cannot be selected has the problem and no place. */
const problemAt = (message: string, kind: FacilitySelectionKind, id: string): Problem => ({
  message,
  locator: locatorOf(kind, id),
})

/** The ids that appear more than once, in the order they first appear, with how many times. */
function repeated(ids: readonly string[]): (readonly [id: string, times: number])[] {
  const counts = new Map<string, number>()
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1)
  return [...counts].filter(([, times]) => times > 1)
}

function idProblems(facility: Facility): Problem[] {
  const lists: readonly (readonly [FacilitySelectionKind, readonly { readonly id: string }[]])[] = [
    ['wing', facility.wings],
    ['join', facility.joins],
    ['phase', facility.phases],
    ['lock', facility.locks],
  ]
  const problems = lists.flatMap(([kind, members]) =>
    repeated(members.map((member) => member.id)).map(([id, times]) =>
      problemAt(`${kind} ${id} is listed ${times} times`, kind, id),
    ),
  )
  // A phase's `exit.to` names a scene, so two phases on one scene make the exit ambiguous.
  const scenes = new Map<string, string[]>()
  for (const phase of facility.phases) scenes.set(phase.scene, [...(scenes.get(phase.scene) ?? []), phase.id])
  for (const [scene, phases] of scenes)
    if (phases.length > 1)
      problems.push({ message: `scene ${scene} is run by ${phases.length} phases: ${phases.join(', ')}` })
  return problems
}

function wingProblems(facility: Facility): Problem[] {
  return facility.wings.flatMap((wing) => {
    const messages: string[] = []
    for (const id of wing.phases) {
      const phase = facility.phases.find((each) => each.id === id)
      if (phase === undefined)
        messages.push(`wing ${wing.id} runs phase ${id}, which the facility does not have`)
      else if (phase.wing !== wing.id)
        messages.push(`wing ${wing.id} lists phase ${id}, which runs in wing ${phase.wing}`)
    }
    if (!wing.phases.includes(wing.reference))
      messages.push(`wing ${wing.id}'s reference phase ${wing.reference} is not one of its phases`)
    return messages.map((message) => problemAt(message, 'wing', wing.id))
  })
}

function phaseProblems(facility: Facility): Problem[] {
  const scenes = new Set(facility.phases.map((phase) => phase.scene))
  return facility.phases.flatMap((phase) => {
    const messages: string[] = []
    const wing = facility.wings.find((each) => each.id === phase.wing)
    if (wing === undefined)
      messages.push(`phase ${phase.id} runs in wing ${phase.wing}, which the facility does not have`)
    else if (!wing.phases.includes(phase.id))
      messages.push(`phase ${phase.id} is not listed by its wing ${wing.id}`)
    for (const room of phase.seen ?? [])
      if (!phase.rooms.includes(room))
        messages.push(`phase ${phase.id} sees the room ${room}, which is not one of its rooms`)
    // The shipped `exit.to` is the scene of the next phase (`clinic`, `bay`, `clinic-dawn`), not a phase id.
    if (phase.exit !== null && !scenes.has(phase.exit.to))
      messages.push(`phase ${phase.id} leaves for the scene ${phase.exit.to}, which no phase runs`)
    for (const lockId of Object.keys(phase.doors)) {
      const lock = facility.locks.find((each) => each.id === lockId)
      if (lock === undefined)
        messages.push(
          `phase ${phase.id} names the lock ${lockId} in its doors, which the facility does not have`,
        )
      else if (!lock.phases.includes(phase.id))
        messages.push(
          `phase ${phase.id} names the lock ${lockId} in its doors, which is not a lock of ${phase.id}`,
        )
    }
    return messages.map((message) => problemAt(message, 'phase', phase.id))
  })
}

function joinProblems(facility: Facility): Problem[] {
  return facility.joins.flatMap((join) => {
    const messages: string[] = []
    const a = joinSideProblem(facility, join.a)
    if (a !== undefined) messages.push(`side a: ${a}`)
    const b = joinSideProblem(facility, join.b)
    if (b !== undefined) messages.push(`side b: ${b}`)
    if (sameJoinSide(join.a, join.b)) messages.push('a join needs two different sides')
    return messages.map((message) => problemAt(`join ${join.id}: ${message}`, 'join', join.id))
  })
}

function lockProblems(facility: Facility): Problem[] {
  return facility.locks.flatMap((lock) => {
    const message = lockProblem(facility, lock)
    return message === undefined ? [] : [problemAt(`lock ${lock.id}: ${message}`, 'lock', lock.id)]
  })
}

function streetProblems(facility: Facility): Problem[] {
  const { path, clear } = facility.street
  const problems: Problem[] = []
  if (path.length < 2) problems.push({ message: 'the street path needs at least two points' })
  // `!(clear > 0)` and not `clear <= 0`: a clearance that is not a number is no clearance either.
  if (!(clear > 0)) problems.push({ message: "the street's clearance must be more than 0" })
  return problems
}

/** Lints: probably wrong, but the game may still run (decision 3 of the plan). */
function noteProblems(facility: Facility): Problem[] {
  const problems: Problem[] = []
  for (const wing of facility.wings)
    for (const phase of Object.keys(wing.differences ?? {}))
      if (!wing.phases.includes(phase))
        problems.push(
          problemAt(
            `wing ${wing.id} has differences for phase ${phase}, which it does not run`,
            'wing',
            wing.id,
          ),
        )
  for (const phase of facility.phases)
    for (const [room, times] of repeated(phase.rooms))
      problems.push(problemAt(`phase ${phase.id} lists the room ${room} ${times} times`, 'phase', phase.id))
  for (const lock of facility.locks) {
    if (lock.door === undefined) continue
    for (const id of lock.phases) {
      const phase = facility.phases.find((each) => each.id === id)
      if (phase !== undefined && !Object.hasOwn(phase.doors, lock.id))
        problems.push(
          problemAt(
            `lock ${lock.id} opens the door ${lock.door}, but the doors of phase ${id} do not list it`,
            'lock',
            lock.id,
          ),
        )
    }
  }
  for (const end of ['start', 'end'] as const) {
    const joins = facility.joins.filter((join) =>
      [join.a, join.b].some((side) => 'street' in side && side.street === end),
    )
    const [first, ...others] = joins
    if (first !== undefined && others.length > 0)
      problems.push({
        message: `the street ${end} is the side of ${joins.length} joins: ${joins.map((join) => join.id).join(', ')}`,
        locator: locatorOf('join', first.id),
        related: locators(...others.map((join) => locatorOf('join', join.id))),
      })
  }
  return problems
}

export function facilityChecks(facility: Facility): FacilityResults {
  return [
    checkResult('facility-ids', idProblems(facility)),
    checkResult('facility-wings', wingProblems(facility)),
    checkResult('facility-phases', phaseProblems(facility)),
    checkResult('facility-joins', joinProblems(facility)),
    checkResult('facility-locks', lockProblems(facility)),
    checkResult('facility-street', streetProblems(facility)),
    checkResult('facility-notes', noteProblems(facility), { severity: 'warning' }),
  ]
}

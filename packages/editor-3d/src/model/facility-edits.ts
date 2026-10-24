// The World edits (ED3D.9a, ED3D spec §5.4): `wing.move`, `join.set`, `join.remove` and `lock.set`. Each is a
// `FacilityEdit`: a value the facility editor runs against the facility, answering the facility it makes or refusing with a
// sentence. They judge what the facility file alone can judge (a name that exists, a number that is a number); what a
// join or a lock means inside the levels it names is the facility checks' (ED3D.9b).
import { SelectionIdError } from '../checks/check'
import type { Facility, FacilityJoin, FacilityLock, JoinSide } from '../format/facility.schema'
import { ok, refuse } from './edit'
import type { FacilityEdit } from './facility-editor'
import { type FacilitySelectionKind, facilitySelection } from './facility-selection'
import { isEmptyName, round4 } from './sector-edit-support'

/** The selection of one World member, or nothing for an id a selection cannot hold (a file this editor did not write). */
function selectionOf(kind: FacilitySelectionKind, id: string): readonly string[] {
  try {
    return [facilitySelection(kind, id)]
  } catch (error) {
    if (error instanceof SelectionIdError) return []
    throw error
  }
}

/** Why a new member cannot take this id: it could never be selected, and the editor selects what it makes. */
const newIdProblem = (kind: FacilitySelectionKind, id: string): string | undefined =>
  selectionOf(kind, id).length === 0
    ? `${kind} id ${JSON.stringify(id)} cannot be empty or hold ":" or "/"`
    : undefined

/** The list with `next` in `current`'s place, or at the end when there is no `current`. */
const upserted = <T>(list: readonly T[], current: T | undefined, next: T): readonly T[] =>
  current === undefined ? [...list, next] : list.map((each) => (each === current ? next : each))

/** True when a member is already what the caller gave, so a set of the same join or lock records no step. A member that is not there (`undefined`) is never the same. */
const sameMember = (current: unknown, next: unknown): boolean =>
  JSON.stringify(current) === JSON.stringify(next)

export interface MoveWingArgs {
  readonly wing: string
  /** Where the wing's own frame sits in the world: [x, y, z] metres. */
  readonly offset: readonly [number, number, number]
}

/** `wing.move`: the wing's offset, rounded as the file prints it. Nudging one wing is one undo step; a drag is a session. */
export function moveWing({ wing, offset }: MoveWingArgs): FacilityEdit {
  return {
    id: 'wing.move',
    label: `Move wing ${wing}`,
    coalesce: `wing.move:${wing}`,
    run(facility: Facility) {
      const current = facility.wings.find((each) => each.id === wing)
      if (current === undefined) return refuse(`no wing ${wing}`)
      if (!offset.every(Number.isFinite)) return refuse(`the offset of ${wing} must be three finite numbers`)
      const next: readonly [number, number, number] = [
        round4(offset[0]),
        round4(offset[1]),
        round4(offset[2]),
      ]
      const select = selectionOf('wing', wing)
      if (next.every((value, axis) => value === current.offset[axis])) return ok(facility, select)
      return ok(
        {
          ...facility,
          wings: facility.wings.map((each) => (each === current ? { ...each, offset: next } : each)),
        },
        select,
      )
    },
  }
}

/** What is wrong with one side of a join, judged from the facility alone: the phase and the room are there, the name is a name. */
function sideProblem(facility: Facility, side: JoinSide): string | undefined {
  if ('street' in side) return undefined
  const phase = facility.phases.find((each) => each.id === side.phase)
  if (phase === undefined) return `no phase ${side.phase}`
  // `rooms` is every room of the phase's blockout and `seen` a subset of it, so a side may name a seen room (the P3 yard).
  if (!phase.rooms.includes(side.room)) return `phase ${side.phase} has no room ${side.room}`
  if ('wall' in side)
    return Number.isInteger(side.wall) && side.wall >= 0
      ? undefined
      : `wall ${side.wall} is not a whole number from 0`
  if ('door' in side) return isEmptyName(side.door) ? 'a door needs a name' : undefined
  return isEmptyName(side.opening) ? 'an opening needs a name' : undefined
}

/** Which place a side is, as one string: two sides with the same key are the same side. */
const sideKey = (side: JoinSide): string => JSON.stringify('street' in side ? [side.street] : sideParts(side))

function sideParts(side: Exclude<JoinSide, { readonly street: unknown }>): readonly unknown[] {
  if ('wall' in side) return [side.phase, side.room, 'wall', side.wall]
  if ('door' in side) return [side.phase, side.room, 'door', side.door]
  return [side.phase, side.room, 'opening', side.opening]
}

/**
 * `join.set`: adds the join, or replaces the one of that id in place (keeping its order). A side must name a phase, a room
 * of that phase and a name or a wall number; whether the two sides meet in the levels is the checks' to say (ED3D.9b).
 */
export function setJoin(join: FacilityJoin): FacilityEdit {
  return {
    id: 'join.set',
    label: `Set join ${join.id}`,
    run(facility: Facility) {
      const current = facility.joins.find((each) => each.id === join.id)
      const idProblem = current === undefined ? newIdProblem('join', join.id) : undefined
      if (idProblem !== undefined) return refuse(idProblem)
      const aProblem = sideProblem(facility, join.a)
      if (aProblem !== undefined) return refuse(`side a: ${aProblem}`)
      const bProblem = sideProblem(facility, join.b)
      if (bProblem !== undefined) return refuse(`side b: ${bProblem}`)
      if (sideKey(join.a) === sideKey(join.b)) return refuse('a join needs two different sides')
      const select = selectionOf('join', join.id)
      if (sameMember(current, join)) return ok(facility, select)
      return ok({ ...facility, joins: upserted(facility.joins, current, join) }, select)
    },
  }
}

/** `join.remove`: the join leaves the file; the editor drops it from the selection. */
export function removeJoin(id: string): FacilityEdit {
  return {
    id: 'join.remove',
    label: `Remove join ${id}`,
    run(facility: Facility) {
      if (!facility.joins.some((each) => each.id === id)) return refuse(`no join ${id}`)
      return ok({ ...facility, joins: facility.joins.filter((each) => each.id !== id) })
    },
  }
}

/** What is wrong with the phases and the place of a lock, judged from the facility alone. */
function lockProblem(facility: Facility, lock: FacilityLock): string | undefined {
  if (lock.phases.length === 0) return 'a lock needs at least one phase'
  const missing = lock.phases.find((id) => !facility.phases.some((phase) => phase.id === id))
  if (missing !== undefined) return `no phase ${missing}`
  const places = typeof lock.at === 'string' ? [lock.at] : lock.at
  if (places.length === 0 || places.some(isEmptyName))
    return 'a lock needs a place: the hotspot, box or wall door it is on'
  return undefined
}

/**
 * `lock.set`: adds the lock, or replaces the one of that id in place. The caller gives the whole lock (spreading the one
 * it has keeps the members this editor does not know). Which door, hotspot or box the place names is the checks' to say
 * (ED3D.9b); a lock is never removed here, since a phase's `doors` name locks by id.
 */
export function setLock(lock: FacilityLock): FacilityEdit {
  return {
    id: 'lock.set',
    label: `Set lock ${lock.id}`,
    run(facility: Facility) {
      const current = facility.locks.find((each) => each.id === lock.id)
      const problem =
        (current === undefined ? newIdProblem('lock', lock.id) : undefined) ?? lockProblem(facility, lock)
      if (problem !== undefined) return refuse(problem)
      const select = selectionOf('lock', lock.id)
      if (sameMember(current, lock)) return ok(facility, select)
      return ok({ ...facility, locks: upserted(facility.locks, current, lock) }, select)
    },
  }
}

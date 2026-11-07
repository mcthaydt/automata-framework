// What the sector edits share (ED3D.3 step 5): the rules an id or a number must meet, how a changed list of sectors gets
// back into the level, and the two checks an edit that adds or reshapes a sector passes before it answers: the engine
// can build the level, and a new sector stands on no other. A refusal is a sentence for the person, never an exception.

import { roundJsonNumber } from '@automata/editor/kit/documents'
import { sectorSelection } from '../checks/check'
import { overlapProblems } from '../checks/overlap'
import { GeometryError, type LevelProfile } from '../profile/level-profile'
import { type EditCorner, type EditSector, SectorAccessError } from '../profile/sector-access'
import { type EditResult, ok, refuse } from './edit'
import { parseSelection } from './selection-ref'

/** Coordinates, heights and lights are written to four decimals, as the codec writes them, and never as `-0`. */
export const round4 = (value: number): number => roundJsonNumber(value) + 0

/** A ceiling is this far above its floor at the least: a sector the player cannot stand in is not a sector. */
const MIN_HEADROOM = 0.5

/** What an id is, of a sector or of a thing: a letter, then letters, digits, - or _. */
export const ID_PATTERN: RegExp = /^[A-Za-z][A-Za-z0-9_-]*$/

/** Why `id` cannot be the id of a sector the edit adds: it is not an id, or the level has it already. */
export function newIdProblem<D>(profile: LevelProfile<D>, level: D, id: string): string | undefined {
  if (!ID_PATTERN.test(id)) return 'the sector id must be an id: a letter, then letters, digits, - or _'
  if (profile.sectors.takenIds(level).includes(id)) return `there is already a sector ${id}`
  return undefined
}

export const sectorOf = <D>(profile: LevelProfile<D>, level: D, id: string): EditSector | undefined =>
  profile.sectors.list(level).find((sector) => sector.id === id)

export const noSector = (id: string): EditResult<never> => refuse(`no sector ${id}`)

/**
 * Why an edit that changes the walls of a sector (`doing`: cut, merged) has to leave it alone: something is tied to them
 * (`SectorAccess.pinned`), in a sentence that lists what. Nothing when nothing is.
 */
export function pinnedProblem<D>(
  profile: LevelProfile<D>,
  level: D,
  id: string,
  doing: string,
): string | undefined {
  const pinned = profile.sectors.pinned(level, id)
  if (pinned.length === 0) return undefined
  return `${id} cannot be ${doing} while something is tied to its walls: ${pinned.join('; ')}`
}

/** The selection id of a sector, or nothing for an id a selection cannot hold (a level this editor did not write). */
export function placeOf(id: string): string | undefined {
  try {
    return sectorSelection(id)
  } catch {
    // The one thing `sectorSelection` throws is that the id has a ":" or a "/" in it.
    return undefined
  }
}

export const numberProblem = (what: string, value: number): string | undefined =>
  Number.isFinite(value) ? undefined : `the ${what} must be a number`

/** What is wrong with a floor and a ceiling (already rounded), in the order a person reads them. */
export function heightsProblem(floor: number, ceiling: number): string | undefined {
  return (
    numberProblem('floor', floor) ??
    numberProblem('ceiling', ceiling) ??
    (ceiling - floor > MIN_HEADROOM
      ? undefined
      : `the ceiling must be more than ${MIN_HEADROOM} m above the floor`)
  )
}

/** A number that must be finite and more than nothing: a width, a height, a light. */
export const positiveProblem = (what: string, value: number): string | undefined =>
  numberProblem(what, value) ?? (value > 0 ? undefined : `the ${what} must be more than 0`)

export const lightProblem = (light: number): string | undefined => positiveProblem('light', light)

/** A name (of a style, a texture, an id) that is there and says nothing. */
export const isEmptyName = (value: string | null | undefined): boolean =>
  typeof value === 'string' && value.trim() === ''

/** The level with these sectors in place of its own, or the refusal of a format that cannot hold one of them. */
export function holdSectors<D>(
  profile: LevelProfile<D>,
  level: D,
  sectors: readonly EditSector[],
): EditResult<D> {
  try {
    return ok(profile.sectors.withSectors(level, sectors))
  } catch (error) {
    if (error instanceof SectorAccessError) return refuse(error.message)
    throw error
  }
}

/** The level with each sector that `changes` names replaced; the level itself when none of them is a different object. */
export function replaceSectors<D>(
  profile: LevelProfile<D>,
  level: D,
  changes: ReadonlyMap<string, EditSector>,
): EditResult<D> {
  const sectors = profile.sectors.list(level)
  if (sectors.every((sector) => (changes.get(sector.id) ?? sector) === sector)) return ok(level)
  return holdSectors(
    profile,
    level,
    sectors.map((sector) => changes.get(sector.id) ?? sector),
  )
}

/** The level with `next` in the place of the sector `id`; the level itself when `next` is that sector. */
export const replaceSector = <D>(
  profile: LevelProfile<D>,
  level: D,
  id: string,
  next: EditSector,
): EditResult<D> => replaceSectors(profile, level, new Map([[id, next]]))

/** A corner at a point with a wall; `[x, z]`, never `[x, z, undefined]`, when it has none. */
export const placed = (x: number, z: number, wall: EditCorner[2]): EditCorner =>
  wall === undefined ? [x, z] : [x, z, wall]

/**
 * A refusal when the engine cannot build `level` (its own sentence: `unknown style plain`), or, when `fresh` names a
 * sector, when that sector overlaps another (ED3-d, `the new sector overlaps hall`). An overlap the level had before
 * is not the edit's to answer for, and sectors that meet at a wall do not overlap.
 */
export function buildRefusal<D>(
  profile: LevelProfile<D>,
  level: D,
  fresh?: string,
): EditResult<never> | undefined {
  let layers: ReturnType<LevelProfile<D>['geometry']>['layers']
  try {
    layers = profile.geometry(level).layers
  } catch (error) {
    if (error instanceof GeometryError) return refuse(error.message)
    throw error
  }
  if (fresh === undefined) return undefined
  const mine = sectorSelection(fresh)
  for (const layer of layers)
    for (const problem of overlapProblems({ map: layer.map, wall: () => undefined })) {
      const places = [problem.locator, ...(problem.related ?? [])].flatMap((place) =>
        place === undefined ? [] : [place.selection],
      )
      if (!places.includes(mine)) continue
      const other = places.find((place) => place !== mine)
      const ref = other === undefined ? undefined : parseSelection(other)
      if (ref?.kind === 'sector') return refuse(`the new sector overlaps ${ref.sector}`, other)
    }
  return undefined
}

/** The level with `sector` added at the end, selected, once the engine has built it and nothing overlaps it. */
export function insertSector<D>(profile: LevelProfile<D>, level: D, sector: EditSector): EditResult<D> {
  const held = holdSectors(profile, level, [...profile.sectors.list(level), sector])
  if (!held.ok) return held
  return buildRefusal(profile, held.level, sector.id) ?? ok(held.level, [sectorSelection(sector.id)])
}

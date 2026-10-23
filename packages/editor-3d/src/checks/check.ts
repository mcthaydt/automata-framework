// What a check answers: Last Light's `result` helper (scripts/pipeline/blockout-lib.ts, 92e6704) with a severity,
// and with each problem carrying where it is, so the editor can frame it (ED3D spec §7). The sentence of a problem
// is Last Light's own, so a level that fails in the game fails the same way here.
import type { Point } from '../format/sector.schema'
import type { Edge, ResolvedMap } from '../geometry/sectors'

export type Severity = 'error' | 'warning'

/** Where a problem is: a selection id (`sector:hall`, `wall:hall/4`, `entity:box/desk`) and a point to frame. */
export interface Locator {
  readonly selection: string
  readonly at?: Point | undefined
}

export interface Problem {
  readonly message: string
  /** Absent when the problem has no place in the document (a puzzle hotspot the level never places). */
  readonly locator?: Locator | undefined
  /** The other places it concerns: the second wall of a shared line, the other room of an overlap. */
  readonly related?: readonly Locator[] | undefined
}

export interface CheckResult {
  /** `ids`, `shared-walls`, `openings`, `overlap`, `heights`, `expand`, `rooms`, `puzzle-hotspots` or `nav`. */
  readonly id: string
  /** No problems. */
  readonly ok: boolean
  readonly severity: Severity
  /** The problems joined by "; ", or the ok text: Last Light's own `detail`. */
  readonly detail: string
  readonly problems: readonly Problem[]
}

export interface CheckResultOptions {
  /** What `detail` says when nothing is wrong. */
  readonly ok?: string | undefined
  readonly severity?: Severity | undefined
}

export function checkResult(
  id: string,
  problems: readonly Problem[],
  options: CheckResultOptions = {},
): CheckResult {
  return {
    id,
    ok: problems.length === 0,
    severity: options.severity ?? 'error',
    detail:
      problems.length > 0 ? problems.map((problem) => problem.message).join('; ') : (options.ok ?? 'ok'),
    problems: [...problems],
  }
}

/** A selection could not be written: an id that would not parse back, or a corner that is no index. */
export class SelectionIdError extends Error {}

/** A selection id is parsed back by splitting on the first ":" and then "/", so no part may hold either. */
function part(what: string, value: string): string {
  if (value === '' || value.includes('/') || value.includes(':'))
    throw new SelectionIdError(
      `${what} ${JSON.stringify(value)} cannot be part of a selection id (empty, or holds "/" or ":")`,
    )
  return value
}

export const sectorSelection = (sectorId: string): string => `sector:${part('sector id', sectorId)}`

/** The wall that starts at the sector's document corner `corner`. */
export function wallSelection(sectorId: string, corner: number): string {
  if (!Number.isInteger(corner) || corner < 0)
    throw new SelectionIdError(`wall corner ${corner} is not a whole number from 0`)
  return `wall:${part('sector id', sectorId)}/${corner}`
}

export const entitySelection = (definition: string, id: string): string =>
  `entity:${part('entity definition', definition)}/${part('entity id', id)}`

/** A point as Last Light writes one in a sentence: x and z to at most three decimals. */
export const formatPoint = (point: Point): string => `${+point.x.toFixed(3)}, ${+point.z.toFixed(3)}`

/**
 * A locator for the selection `selection()` writes, or nothing when the document's names cannot be a selection id (a room
 * called "a/b"): a check reports the problem without a place and never fails on a strange name.
 */
export function place(selection: () => string, at?: Point): Locator | undefined {
  try {
    return { selection: selection(), at }
  } catch (error) {
    if (error instanceof SelectionIdError) return undefined
    throw error
  }
}

/** The places in the list that exist, in order. */
export const locators = (...places: readonly (Locator | undefined)[]): Locator[] =>
  places.filter((locator): locator is Locator => locator !== undefined)

/** What the geometry checks read: the resolved level, and where a wall is in the document (a selection id and a point). */
export interface GeometryContext {
  readonly map: ResolvedMap
  /** Where a wall is in the document; nothing when it cannot be told. */
  readonly wall: (edge: Edge) => Locator | undefined
}

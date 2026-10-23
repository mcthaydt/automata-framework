import type { Diagnostic } from '../profile'
import type { ListIds } from './stage-document'
import { TUNABLES, type TunableDeclaration } from './tunables'

// What the stage checks (EDFF.1b) share: the context they may read, the finding they write, and the path of a list element.

/** What the checks may know beyond the stage; every member is optional and a missing one means "use the bundled one". */
export interface StageCheckContext {
  /** The asset aliases of the loaded art manifest. Absent, aliases are not checked (one info finding says so). */
  readonly aliases?: ReadonlySet<string> | undefined
  /** The tunable declarations; the bundled ones (FloorFifty's, `tunables.ts`) when absent. */
  readonly tunables?: Readonly<Record<string, TunableDeclaration>> | undefined
  /** The values of `tuning.toml`; the declared defaults when absent. */
  readonly baseTuning?: Readonly<Record<string, number>> | undefined
  /** The top floor of the tallest finite course; 49 when absent (spec §10.2). */
  readonly tallestFloor?: number | undefined
}

export interface ResolvedCheckContext {
  readonly aliases: ReadonlySet<string> | undefined
  readonly tunables: Readonly<Record<string, TunableDeclaration>>
  readonly baseTuning: Readonly<Record<string, number>>
  readonly tallestFloor: number
}

export const DEFAULT_TALLEST_FLOOR = 49

export function resolveContext(context: StageCheckContext): ResolvedCheckContext {
  return {
    aliases: context.aliases,
    tunables: context.tunables ?? TUNABLES,
    baseTuning: context.baseTuning ?? {},
    tallestFloor: context.tallestFloor ?? DEFAULT_TALLEST_FLOOR,
  }
}

export function problem(code: string, path: string, message: string, fix?: string): Diagnostic {
  return { severity: 'error', code, path, message, ...(fix === undefined ? {} : { fix }) }
}

export function warning(code: string, path: string, message: string): Diagnostic {
  return { severity: 'warning', code, path, message }
}

export function note(code: string, path: string, message: string): Diagnostic {
  return { severity: 'info', code, path, message }
}

type IdList = keyof ListIds

const LIST_PATHS: Readonly<Record<IdList, string>> = {
  extension: 'course.extension',
  layers: 'theme.layers',
  setPieces: 'theme.setPieces',
}

/** `theme.layers[b2]`: the path of an element of a list, by its id, which a reorder does not change. */
export function elementPath(ids: ListIds, list: IdList, index: number): string {
  return `${LIST_PATHS[list]}[${ids[list][index] ?? index}]`
}

/**
 * Why a number is outside its range, in words. `isNot` begins the sentence about a value that is not a number at all
 * (`Horizon lift`), `has` the one about a value out of range (`Horizon lift is`): `Horizon lift is 49; it goes from 0 to 48.`
 */
export function rangeText(
  isNot: string,
  has: string,
  value: number,
  min: number,
  max: number,
  whole = false,
): string {
  if (Number.isNaN(value)) return `${isNot} is not a number.`
  return `${has} ${value}; it ${whole ? 'is a whole number from' : 'goes from'} ${min} to ${max}.`
}

/** Is `value` a number within the inclusive range? NaN is not. */
export function inRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max
}

const SEVERITY_RANK: Readonly<Record<Diagnostic['severity'], number>> = { error: 0, warning: 1, info: 2 }

/** Errors first, then warnings, then info; findings of one severity keep the order the checks found them in. */
export function sortBySeverity(findings: readonly Diagnostic[]): Diagnostic[] {
  return [...findings].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
}

// The profiles this editor opens, and how a file says which one it is: an AF sector file names its format. Detection
// reads the text only far enough to choose; the chosen profile's codec does the real reading and says what is wrong
// with the file.
import { JsonScanError, scan } from '@automata/editor/kit/documents'
import { afSectorProfile } from './af-sector-profile'
import type { LevelProfile } from './level-profile'

const PROFILES: readonly LevelProfile<unknown>[] = [afSectorProfile]

/** Every profile the editor opens, in the order detection tries them. */
export function profiles(): readonly LevelProfile<unknown>[] {
  return PROFILES
}

export type Detected = { readonly profile: LevelProfile<unknown> } | { readonly reason: string }

const NOT_A_LEVEL =
  'not a level this editor opens: it reads an af-sector file (a "format" starting af-sector/)'

export function detectProfile(text: string): Detected {
  try {
    scan(text)
  } catch (error) {
    if (error instanceof JsonScanError) return { reason: `not JSON: ${error.message}` }
    throw error
  }
  const value: unknown = JSON.parse(text)
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return { reason: NOT_A_LEVEL }
  const file = value as Record<string, unknown>
  if (typeof file.format === 'string' && file.format.startsWith('af-sector/'))
    return { profile: afSectorProfile }
  return { reason: NOT_A_LEVEL }
}

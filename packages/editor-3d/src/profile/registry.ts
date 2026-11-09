// The profiles this editor opens, and how a file says which one it is: an AF sector file names its format, a Last
// Light blockout is the file with a scene and rooms. Detection reads the text only far enough to choose; the chosen
// profile's codec does the real reading and says what is wrong with the file.
import { JsonScanError, scan } from '@automata/editor/kit/documents'
import { afSectorProfile } from './af-sector-profile'
import { lastLightProfile } from './last-light-profile'
import type { LevelProfile } from './level-profile'

const PROFILES: readonly LevelProfile<unknown>[] = [afSectorProfile, lastLightProfile]

/** Every profile the editor opens, in the order detection tries them. */
export function profiles(): readonly LevelProfile<unknown>[] {
  return PROFILES
}

/**
 * Whether a level of this profile can belong to a facility file (`facility.json`, its own codec, no profile): only a
 * Last Light blockout does. The app looks for one beside such a level, so World can show the wings it belongs to.
 */
export function hasFacility(profile: LevelProfile<unknown>): boolean {
  return profile === (lastLightProfile as LevelProfile<unknown>)
}

export type Detected = { readonly profile: LevelProfile<unknown> } | { readonly reason: string }

const NOT_A_LEVEL =
  'not a level this editor opens: it reads an af-sector file (a "format" starting af-sector/) or a Last Light blockout (a "scene" and "rooms")'

const FACILITY =
  'this is a Last Light facility file (last-light-facility): it has a codec but no level to draw; open one of its wings’ blockouts'

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
  if (typeof file.scene === 'string' && Array.isArray(file.rooms)) return { profile: lastLightProfile }
  if (Array.isArray(file.wings) && Array.isArray(file.joins)) return { reason: FACILITY }
  return { reason: NOT_A_LEVEL }
}

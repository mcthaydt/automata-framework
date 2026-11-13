// The look's library entry and its parser: a game's look is a partial look laid over the default one.

import library from './library/look.json' with { type: 'json' }
import { type HazeProfile, type Look, lookSchema } from './look.schema.ts'

export type { HazeProfile, Look, LookSwitches } from './look.schema.ts'

/**
 * `haze` as the library's own: its colour is the day colour the renderer lights by the time of day (`HazeProfile.lit`). The
 * mark is not enumerable, so a game that copies the profile to change it (`{ ...DEFAULT_LOOK.haze, colour }`) does not
 * inherit it: a colour a game writes is its own, and is drawn as given.
 */
function libraryHaze(haze: HazeProfile): HazeProfile {
  return Object.defineProperty({ ...haze }, 'lit', { value: true, enumerable: false })
}

const withLibraryHaze = (look: Look): Look => ({ ...look, haze: libraryHaze(look.haze) })

/** The library's look, checked by the schema when this file loads. */
export const DEFAULT_LOOK: Look = withLibraryHaze(lookSchema.parse(library))

/** A look from what a game wrote: every field it leaves out is the default's; a bad one says which. */
export function parseLook(input: unknown): Look {
  const given = (input ?? {}) as Record<string, unknown>
  const merged: Record<string, unknown> = { ...DEFAULT_LOOK }
  for (const [key, value] of Object.entries(given)) {
    const base = merged[key]
    merged[key] =
      typeof base === 'object' && base !== null && typeof value === 'object' && value !== null
        ? { ...base, ...value }
        : value
  }
  const look = lookSchema.parse(merged)
  // The colour is the library's unless the game wrote one (or said `lit` itself): then it is lit as the library's is.
  const haze = given['haze']
  const ownsColour = typeof haze === 'object' && haze !== null && ('colour' in haze || 'lit' in haze)
  return ownsColour ? look : withLibraryHaze(look)
}

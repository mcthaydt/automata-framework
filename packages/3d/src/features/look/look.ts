// The look's library entry and its parser: a game's look is a partial look laid over the default one.

import library from './library/look.json' with { type: 'json' }
import { type Look, lookSchema } from './look.schema.ts'

export type { Look, LookSwitches } from './look.schema.ts'

/** The library's look, checked by the schema when this file loads. */
export const DEFAULT_LOOK: Look = lookSchema.parse(library)

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
  return lookSchema.parse(merged)
}

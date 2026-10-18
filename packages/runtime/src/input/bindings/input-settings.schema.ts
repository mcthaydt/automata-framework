// The player's saved bindings (M4 spec §4.5): `input` in the game's settings record. Only what the player changed is
// kept, per action and field, over the game's profile, so a game update that adds an action keeps the player's
// other bindings. `profile` is the id of the profile the overrides were made against: overrides for another profile
// are not applied (`applyOverrides`).
import { z } from 'zod'
import type { TouchMode } from '../input-profile.schema.js'

/** What the player changed about one action: its keys, its pad buttons, or both. */
export interface BindingOverride {
  readonly keys?: readonly string[] | undefined
  readonly pad?: readonly number[] | undefined
}

export interface InputSettings {
  readonly profile: string
  readonly overrides: Readonly<Record<string, BindingOverride>>
  /** How touch drives play, when the player chose (M4 spec §4.4). Unset: the game's default. */
  readonly touchMode?: TouchMode | undefined
}

/** Nothing changed: the game's profile as it ships. */
export const INPUT_SETTINGS_DEFAULT: InputSettings = { profile: '', overrides: {} }

const overrideSchema = z.object({
  keys: z.array(z.string()).optional(),
  pad: z.array(z.number()).optional(),
})

/**
 * The `input` field of a game's settings schema: `{ input: inputSettingsSchema }`. A record that does not read is
 * the default, as every settings field falls back (`readSettings`); a single bad override is `applyOverrides`'s to
 * drop, so the player's other bindings survive it.
 */
export const inputSettingsSchema: z.ZodType<InputSettings, unknown> = z
  .object({
    profile: z.string(),
    overrides: z.record(z.string(), overrideSchema),
    touchMode: z.enum(['buttons', 'swipe']).optional(),
  })
  .catch(() => ({ profile: '', overrides: {} }))

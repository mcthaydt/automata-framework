// The core settings (M4 spec §4.5, §4.8, M4-D8): what a game that declares no `settings` saves, so the Settings
// screen's Controls and Display sections always have a place for the player's choices. A game with settings of its
// own keeps them only when its schema has the same fields: `input: inputSettingsSchema` and
// `display: displaySettingsSchema`.
import { z } from 'zod'
import {
  INPUT_SETTINGS_DEFAULT,
  type InputSettings,
  inputSettingsSchema,
} from '../input/bindings/input-settings.schema.js'
import { AUDIO_SETTINGS_DEFAULT, type AudioSettings, audioSettingsSchema } from './audio-settings.schema.js'
import { DEFAULT_QUALITY, type DisplaySettings, displaySettingsSchema } from './display-settings.schema.js'
import type { SettingsDef } from './migrate-settings.js'

/** The settings every game carries: input bindings, display, audio and vibration. */
export interface CoreSettings {
  readonly input: InputSettings
  readonly display: DisplaySettings
  /** The Audio group's choices (M5.4); a record saved before it reads them as the defaults. */
  readonly audio: AudioSettings
  /** The Vibration group's toggle (Owner, 2026-10-18); a record saved before it reads it as on. */
  readonly haptics: HapticsSettings
}

/** The player's Vibration setting: whether `Haptics` pulses at all. */
export interface HapticsSettings {
  readonly enabled: boolean
}

const HAPTICS_DEFAULT: HapticsSettings = { enabled: true }
/** On unless saved off; a bad record reads as on, as every settings field falls back. */
export const hapticsSettingsSchema: z.ZodType<HapticsSettings, unknown> = z
  .object({ enabled: z.boolean().default(true) })
  .catch(HAPTICS_DEFAULT)

const DEFAULTS: CoreSettings = {
  input: INPUT_SETTINGS_DEFAULT,
  display: { quality: DEFAULT_QUALITY },
  audio: AUDIO_SETTINGS_DEFAULT,
  haptics: HAPTICS_DEFAULT,
}

const coreSettingsSchema: z.ZodType<CoreSettings> = z.object({
  input: inputSettingsSchema,
  display: displaySettingsSchema.catch(() => ({ quality: DEFAULT_QUALITY })),
  audio: audioSettingsSchema.default(AUDIO_SETTINGS_DEFAULT),
  haptics: hapticsSettingsSchema.default(HAPTICS_DEFAULT),
})

/** The `settings` save, version 1: the player's bindings (`input`), graphics quality (`display`), audio (`audio`) and vibration (`haptics`). */
export const CORE_SETTINGS: SettingsDef<CoreSettings> = {
  key: 'settings',
  version: 1,
  schema: coreSettingsSchema,
  defaults: DEFAULTS,
  // The sound belongs to the device, not the player's account (M5 spec §4.5): muting a Mac must not mute the iPad.
  deviceFields: ['audio'],
}

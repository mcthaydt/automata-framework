// The core settings: what a game that declares no `settings` saves, so the Settings
// screen's Controls and Display sections always have a place for the player's choices. A game with settings of its
// own keeps them only when its schema has the same fields: `input: inputSettingsSchema`,
// `display: displaySettingsSchema` and, for a camera the player turns, `camera: cameraSettingsSchema`.
import { z } from 'zod'
import {
  AUDIO_SETTINGS_DEFAULT,
  type AudioSettings,
  audioSettingsSchema,
} from '../features/audio/audio-settings.schema.js'
import {
  CAMERA_SETTINGS_DEFAULT,
  type CameraSettings,
  cameraSettingsSchema,
} from '../features/input/analog/camera-settings.schema.js'
import {
  INPUT_SETTINGS_DEFAULT,
  type InputSettings,
  inputSettingsSchema,
} from '../features/input/bindings/input-settings.schema.js'
import {
  DEFAULT_QUALITY,
  type DisplaySettings,
  displaySettingsSchema,
} from '../shared/runtime/display-settings.schema.js'
import type { SettingsDef } from '../shared/runtime/settings/migrate-settings.js'

/** The settings every game carries: input bindings, display, audio and vibration. */
export interface CoreSettings {
  readonly input: InputSettings
  readonly display: DisplaySettings
  /** The Audio group's choices; a record saved before it reads them as the defaults. */
  readonly audio: AudioSettings
  /** The Vibration group's toggle (Owner, 2026-10-18); a record saved before it reads it as on. */
  readonly haptics: HapticsSettings
  /** "Camera turn speed" and "Invert camera"; a record saved before them reads them as the defaults. */
  readonly camera: CameraSettings
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
  camera: CAMERA_SETTINGS_DEFAULT,
}

const coreSettingsSchema: z.ZodType<CoreSettings> = z.object({
  input: inputSettingsSchema,
  display: displaySettingsSchema.catch(() => ({ quality: DEFAULT_QUALITY })),
  audio: audioSettingsSchema.default(AUDIO_SETTINGS_DEFAULT),
  haptics: hapticsSettingsSchema.default(HAPTICS_DEFAULT),
  camera: cameraSettingsSchema.default(CAMERA_SETTINGS_DEFAULT),
})

/**
 * The `settings` save, version 1: the player's bindings (`input`), graphics quality (`display`), audio (`audio`),
 * vibration (`haptics`) and camera turn (`camera`).
 */
export const CORE_SETTINGS: SettingsDef<CoreSettings> = {
  key: 'settings',
  version: 1,
  schema: coreSettingsSchema,
  defaults: DEFAULTS,
  // The sound belongs to the device, not the player's account: muting a Mac must not mute the iPad.
  deviceFields: ['audio'],
}

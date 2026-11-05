import { z } from 'zod'
import { type AudioBusGains, audioBusGainsSchema } from './audio-buses.schema.js'

/**
 * The player's audio choices, as FloorFifty's `audio` settings: the mute, the mute while another
 * window has focus, and a gain per bus. The one owner of their shape: the Settings screen's Audio group and the
 * `Audio` service read it from here. Kept on the device, not in the player's saves: `CORE_SETTINGS.deviceFields`.
 */
export interface AudioSettings {
  readonly muted: boolean
  readonly muteUnfocused: boolean
  readonly gains: AudioBusGains
}

/** Not muted, every bus at full. */
export const AUDIO_SETTINGS_DEFAULT: AudioSettings = {
  muted: false,
  muteUnfocused: false,
  gains: { master: 1, music: 1, sfx: 1, ui: 1, voice: 1 },
}

/** A missing field takes its default; a bad record reads as the defaults, as every settings field falls back. */
export const audioSettingsSchema: z.ZodType<AudioSettings, unknown> = z
  .object({
    muted: z.boolean().default(false),
    muteUnfocused: z.boolean().default(false),
    gains: audioBusGainsSchema.default(AUDIO_SETTINGS_DEFAULT.gains),
  })
  .catch(AUDIO_SETTINGS_DEFAULT)

import { z } from 'zod'

/**
 * The core audio buses (PRODUCT spec §2 F1): `master` carries the other four; M5-D3 added `voice` (announcers,
 * dialogue). Every change to the set is an API change (PRODUCT spec §2 F6).
 */
export const AUDIO_BUS_NAMES: readonly ['master', 'music', 'sfx', 'ui', 'voice'] = [
  'master',
  'music',
  'sfx',
  'ui',
  'voice',
]

/** One of `AUDIO_BUS_NAMES`. */
export type AudioBusName = (typeof AUDIO_BUS_NAMES)[number]

/** The player's gain per bus, 0 (silent) to 1 (full), as a game's settings store it. */
export type AudioBusGains = Readonly<Record<AudioBusName, number>>

const gain = z.number().min(0).max(1).default(1)

/**
 * Validates saved bus gains; a bus left out is at full gain. A gain outside 0..1 fails the parse rather than
 * being clamped, so `SettingsDef`'s fallback to defaults (runtime `readSettings`) applies to a bad record.
 */
export const audioBusGainsSchema: z.ZodType<
  AudioBusGains,
  Partial<Record<AudioBusName, number | undefined>>
> = z.object({ master: gain, music: gain, sfx: gain, ui: gain, voice: gain })

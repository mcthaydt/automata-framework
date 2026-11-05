// The player's audio settings as the default screens use them (M5.4): read from the settings store, applied to the
// `Audio` service and its buses, and saved back. One place, so the title (at boot), Pause's Mute and Settings' Audio
// group never disagree about what is saved and what is heard.

import type { Audio } from '../../../features/audio/audio.manager.ts'
import { AUDIO_BUS_NAMES } from '../../../features/audio/audio-buses.schema.ts'
import type { AudioBuses } from '../../../features/audio/audio-buses.ts'
import { type AudioSettings, audioSettingsSchema } from '../../../features/audio/audio-settings.schema.ts'
import type { SettingsStore } from '../../../shared/runtime/settings/settings.manager.ts'

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {}

/** The saved audio settings; the defaults without a store or a readable record. */
export const savedAudio = (store: SettingsStore<unknown> | undefined): AudioSettings =>
  audioSettingsSchema.parse(asRecord(store?.get()).audio)

/** The services the settings drive: the mutes on `Audio`, the gains on its buses. */
export interface AudioTargets {
  readonly audio: Audio
  readonly buses: AudioBuses
}

/** Makes the mix what the settings say: the mutes and every bus's gain. */
export function applyAudio({ audio, buses }: AudioTargets, settings: AudioSettings): void {
  audio.setMuted(settings.muted)
  audio.setMuteUnfocused(settings.muteUnfocused)
  for (const bus of AUDIO_BUS_NAMES) buses.setGain(bus, settings.gains[bus])
}

/** Applies `settings` and saves them with the rest of the player's settings. */
export function changeAudio(
  targets: AudioTargets,
  store: SettingsStore<unknown> | undefined,
  settings: AudioSettings,
): void {
  applyAudio(targets, settings)
  store?.update((value) => ({ ...asRecord(value), audio: settings }))
}

// TEMPORARY (task 5.4): the Effect tags of features that are already plain TypeScript, for the parts of the runtime
// that still read services from an Effect context (boot, the default screens). Deleted when `app/` is converted.
import { Context, Effect } from 'effect'
import type { Audio as AudioService } from '../../features/audio/audio.manager.ts'
import type { AudioBuses as AudioBusesService } from '../../features/audio/audio-buses.ts'
import type { Locale as LocaleService } from '../../features/locale/locale.manager.ts'
import {
  type SettingsDef,
  type Settings as SettingsService,
  type SettingsStore,
  storeOf,
} from '../../shared/runtime/settings/settings.manager.ts'

/** The locale service: the game's locales, the one text is drawn in now, the player's choice and the text direction. */
export type Locale = LocaleService
export const Locale: Context.Tag<LocaleService, LocaleService> = Context.GenericTag<LocaleService>(
  '@mcthaydt/automata-runtime/Locale',
)

/** The booted game's settings as a runtime service: its key and store, both undefined for a game without settings. */
export type Settings = SettingsService
export const Settings: Context.Tag<SettingsService, SettingsService> = Context.GenericTag<SettingsService>(
  '@mcthaydt/automata-runtime/Settings',
)

/** Returns the booted settings store when `def.key` matches; dies with a defect when it does not. */
export function settingsStore<S>(
  def: SettingsDef<S>,
): Effect.Effect<SettingsStore<S>, never, SettingsService> {
  return Effect.map(Settings, (settings) => storeOf(settings, def))
}

/**
 * The audio service: one-shot sounds and looping music on the audio buses, unlocked by the first gesture after
 * `session.ready`; the game runs silent when no audio context can be built.
 */
export type Audio = AudioService
export const Audio: Context.Tag<AudioService, AudioService> = Context.GenericTag<AudioService>(
  '@mcthaydt/automata-runtime/Audio',
)

/** The audio-bus seam. The audio service implements it. */
export type AudioBuses = AudioBusesService
export const AudioBuses: Context.Tag<AudioBusesService, AudioBusesService> =
  Context.GenericTag<AudioBusesService>('@mcthaydt/automata-runtime/AudioBuses')

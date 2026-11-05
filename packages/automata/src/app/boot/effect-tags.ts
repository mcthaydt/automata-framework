// TEMPORARY (task 5.4): the Effect tags of features that are already plain TypeScript, for the parts of the runtime
// that still read services from an Effect context (boot, the default screens). Deleted when `app/` is converted.
import { Context, Effect } from 'effect'
import type { Locale as LocaleService } from '../../features/locale/locale.manager.ts'
import {
  type SettingsDef,
  type Settings as SettingsService,
  type SettingsStore,
  storeOf,
} from '../../shared/runtime/settings/settings.manager.ts'

/** The locale service, as the runtime's context holds it. */
export type Locale = LocaleService
export const Locale: Context.Tag<LocaleService, LocaleService> = Context.GenericTag<LocaleService>(
  '@mcthaydt/automata-runtime/Locale',
)

/** The booted game's settings, as the runtime's context holds them. */
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

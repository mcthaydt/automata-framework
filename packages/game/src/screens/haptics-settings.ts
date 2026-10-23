// The player's Vibration setting as the default screens use it (Owner, 2026-10-18): read from the settings store,
// applied to `Haptics`, and saved back, in one place, as `audio-settings.ts` does for the mix.
import { type Haptics, hapticsSettingsSchema, type SettingsStore } from '@mcthaydt/automata-runtime'

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {}

/** Whether the player wants vibration: on without a store or a readable record. */
export const savedHaptics = (store: SettingsStore<unknown> | undefined): boolean =>
  hapticsSettingsSchema.parse(asRecord(store?.get()).haptics).enabled

/** Applies the setting and saves it with the rest of the player's settings. */
export function changeHaptics(
  haptics: Haptics,
  store: SettingsStore<unknown> | undefined,
  enabled: boolean,
): void {
  haptics.setEnabled(enabled)
  store?.update((value) => ({ ...asRecord(value), haptics: { enabled } }))
}

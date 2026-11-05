import type { HostingSaves } from '../../host/hosting.ts'
import type { DeviceStorage } from './device-storage.js'
import {
  readSettings,
  type SettingsDef,
  writeAccountSettings,
  writeDeviceSettings,
} from './migrate-settings.js'

export type { SettingsDef } from './migrate-settings.js'

/** A game's settings value: read it, subscribe to changes, and update it (each update is saved). */
export interface SettingsStore<S> {
  get(): S
  subscribe(listener: (value: S) => void): () => void
  update(change: (value: S) => S): void
}

/**
 * The booted game's settings as a runtime service: its key and store, both undefined for a game without
 * settings.
 */
export interface Settings {
  readonly key: string | undefined
  readonly store: SettingsStore<unknown> | undefined
}

/**
 * The booted store for `def`. Throws when `def` is not the game's settings: asking for another key is the game's
 * mistake, and a store made up on the spot would save under a key nothing reads.
 */
export function settingsStore<S>(settings: Settings, def: SettingsDef<S>): SettingsStore<S> {
  if (settings.key !== def.key || settings.store === undefined) {
    throw new Error(
      `settingsStore: requested settings key '${def.key}' does not match booted settings key '${settings.key}'`,
    )
  }
  return settings.store as SettingsStore<S>
}

/**
 * Creates the Settings service over Hosting.saves. `update` saves in the background, so a change shows at once.
 * Refused saves are reported through `warn`; no fallback to localStorage or device storage (AGENTS.md, Honor host authority).
 *
 * The fields `def.deviceFields` names live in `device` instead: read from it, written to it, and never
 * sent to the saves, whose copy is not read either. `device` is undefined, or throws, where the site's storage is
 * blocked; those fields then hold for the visit only. That is a choice per field, not a fallback for a denied grant.
 */
export function createSettings<S>(
  def: SettingsDef<S> | undefined,
  raw: string | null,
  saves: Pick<HostingSaves, 'set'>,
  device?: DeviceStorage,
  warn: (message: string) => void = (message) => console.warn(message),
): Settings {
  if (def === undefined) {
    return { key: undefined, store: undefined }
  }

  const deviceKey = `${def.key}:device`
  const hasDeviceFields = (def.deviceFields?.length ?? 0) > 0
  for (const field of def.deviceFields ?? []) {
    if (!(field in (def.defaults as object)))
      throw new Error(`Settings '${def.key}': deviceFields names '${field}', which is not one of its fields`)
  }
  const readDevice = (): string | null => {
    if (!hasDeviceFields) return null
    try {
      return device?.get(deviceKey) ?? null
    } catch {
      return null // Blocked: this device has none of its own, so the defaults stand.
    }
  }
  // What each home holds as far as this store knows, so a change that does not touch a home does not rewrite it.
  // The account starts unknown: the first update rewrites it, which also drops a device field an older build left.
  let deviceHeld = readDevice()
  let accountHeld: string | undefined

  let current = readSettings(def, raw, deviceHeld)
  const listeners = new Set<(value: S) => void>()

  const store: SettingsStore<S> = {
    get(): S {
      return current
    },
    subscribe(listener: (value: S) => void): () => void {
      listeners.add(listener)
      // Svelte store contract: called at once upon subscription
      listener(current)
      return () => {
        listeners.delete(listener)
      }
    },
    update(change: (value: S) => S): void {
      current = change(current)
      for (const listener of [...listeners]) {
        listener(current)
      }

      // Memory first. The device's part next, so a refused save cannot lose it; a device that throws keeps it for
      // the visit, and it is never sent to the saves instead.
      if (hasDeviceFields) {
        const own = writeDeviceSettings(def, current)
        if (own !== deviceHeld) {
          try {
            device?.set(deviceKey, own)
            deviceHeld = own
          } catch {
            // Remembered for this visit only.
          }
        }
      }

      // Then the player's part, saved in the background.
      // No device-storage fallback (AGENTS.md, Honor host authority).
      const payload = writeAccountSettings(def, current)
      if (payload === accountHeld) return
      accountHeld = payload
      void saves.set(def.key, payload).then((result) => {
        if (result.ok) return
        if (accountHeld === payload) accountHeld = undefined // so the next change tries again
        warn(`settings: saves.set for '${def.key}' failed: ${result.reason.code}`)
      })
    },
  }

  return {
    key: def.key,
    store: store as SettingsStore<unknown>,
  }
}

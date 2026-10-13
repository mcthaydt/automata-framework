import type { HostingSaves } from '@mcthaydt/automata-host'
import { Context, Effect, Runtime } from 'effect'
import { readSettings, type SettingsDef, writeSettings } from './migrate-settings.js'

export type { SettingsDef } from './migrate-settings.js'

export interface SettingsStore<S> {
  get(): S
  subscribe(listener: (value: S) => void): () => void
  update(change: (value: S) => S): void
}

export interface Settings {
  readonly key: string | undefined
  readonly store: SettingsStore<unknown> | undefined
}

export const Settings: Context.Tag<Settings, Settings> = Context.GenericTag<Settings>(
  '@mcthaydt/automata-runtime/Settings',
)

/**
 * Returns the booted settings store when def.key matches.
 * Dies with a defect if requested key does not match booted key (planning note 7).
 */
export function settingsStore<S>(def: SettingsDef<S>): Effect.Effect<SettingsStore<S>, never, Settings> {
  return Effect.gen(function* () {
    const settings = yield* Settings
    if (settings.key !== def.key || settings.store === undefined) {
      return yield* Effect.dieMessage(
        `settingsStore: requested settings key '${def.key}' does not match booted settings key '${settings.key}'`,
      )
    }
    return settings.store as SettingsStore<S>
  })
}

/**
 * Creates the Settings service over Hosting.saves.
 * Captures Effect.runtime() so update (a plain function) can fork saves.set without blocking.
 * Refused saves log a warning; no fallback to localStorage or device storage (AGENTS.md, Honor host authority).
 */
export function makeSettings<S>(
  def: SettingsDef<S> | undefined,
  raw: string | null,
  saves: HostingSaves,
): Effect.Effect<Settings> {
  if (def === undefined) {
    return Effect.succeed({ key: undefined, store: undefined })
  }

  return Effect.gen(function* () {
    let current = readSettings(def, raw)
    const listeners = new Set<(value: S) => void>()
    const runtime = yield* Effect.runtime<never>()

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

        // Memory first, then saves.set in a runtime fiber.
        // No device-storage fallback (AGENTS.md, Honor host authority).
        const payload = writeSettings(def, current)
        Runtime.runFork(runtime)(
          saves
            .set(def.key, payload)
            .pipe(
              Effect.catchAll((err) =>
                Effect.logWarning(`settings: saves.set for '${def.key}' failed: ${String(err)}`),
              ),
            ),
        )
      },
    }

    return {
      key: def.key,
      store: store as SettingsStore<unknown>,
    }
  })
}

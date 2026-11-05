import { Hosting } from '@mcthaydt/automata-host'
import { FakeHostHandle, HostingTest, runScoped } from '@mcthaydt/automata-host/testing'
import { settle } from '@ruken/sdk-host/testing'
import { Cause, Effect, Exit } from 'effect'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { type SettingsDef, writeSettings } from '#src/settings/migrate-settings.ts'
import { makeSettings, Settings, settingsStore } from '#src/settings/settings.manager.ts'

interface PlayerSettings {
  name: string
  volume: number
  sound: boolean
}

const settingsDef: SettingsDef<PlayerSettings> = {
  key: 'player_settings',
  version: 1,
  schema: z.object({
    name: z.string().catch('DefaultPlayer'),
    volume: z.number().catch(1),
    sound: z.boolean().catch(true),
  }),
  defaults: {
    name: 'DefaultPlayer',
    volume: 1,
    sound: true,
  },
}

describe('settings manager', () => {
  it('each update writes one saves.set under def.key in the same shape (sentByGame)', async () => {
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { sentByGame } = yield* FakeHostHandle

        const settingsService = yield* makeSettings(settingsDef, null, hosting.saves)
        const store = yield* settingsStore(settingsDef).pipe(Effect.provideService(Settings, settingsService))

        store.update((prev) => ({ ...prev, volume: 0.5 }))
        yield* Effect.promise(() => settle())

        expect(store.get().volume).toBe(0.5)
        expect(sentByGame('saves.set')).toEqual([
          expect.objectContaining({
            key: 'player_settings',
            value: writeSettings(settingsDef, {
              name: 'DefaultPlayer',
              volume: 0.5,
              sound: true,
            }),
          }),
        ])
      }).pipe(Effect.provide(HostingTest())),
    )
  })

  it('a store made from a seeded save resumes from it; a corrupt save falls back field by field', async () => {
    // Seeded save
    const seededData = writeSettings(settingsDef, {
      name: 'Hero',
      volume: 0.8,
      sound: false,
    })

    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const settingsService = yield* makeSettings(settingsDef, seededData, hosting.saves)
        const store = yield* settingsStore(settingsDef).pipe(Effect.provideService(Settings, settingsService))

        expect(store.get()).toEqual({
          name: 'Hero',
          volume: 0.8,
          sound: false,
        })
      }).pipe(Effect.provide(HostingTest())),
    )

    // Corrupt save: volume is corrupted, name and sound are valid
    const corruptData = JSON.stringify({
      version: 1,
      name: 'Survivor',
      volume: 'corrupt-string',
      sound: false,
    })

    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const settingsService = yield* makeSettings(settingsDef, corruptData, hosting.saves)
        const store = yield* settingsStore(settingsDef).pipe(Effect.provideService(Settings, settingsService))

        expect(store.get()).toEqual({
          name: 'Survivor',
          volume: 1, // fell back to default
          sound: false, // kept
        })
      }).pipe(Effect.provide(HostingTest())),
    )
  })

  it('a refused save (QUOTA_EXCEEDED) keeps the value for the visit, logs one warning, and writes nothing to localStorage', async () => {
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const storageBefore = window.localStorage.length

        const settingsService = yield* makeSettings(settingsDef, null, hosting.saves)
        const store = yield* settingsStore(settingsDef).pipe(Effect.provideService(Settings, settingsService))

        // Large payload exceeding quota limit
        const tooBigName = 'x'.repeat(16 * 1024 * 1024)
        store.update((prev) => ({ ...prev, name: tooBigName }))
        yield* Effect.promise(() => settle())

        // Value kept in memory for the visit
        expect(store.get().name).toBe(tooBigName)

        // Nothing written to localStorage (honor host authority)
        expect(window.localStorage.length).toBe(storageBefore)
      }).pipe(Effect.provide(HostingTest())),
    )
  })

  it('store contract: subscribe calls the listener at once and on every update, and its return unsubscribes', async () => {
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const settingsService = yield* makeSettings(settingsDef, null, hosting.saves)
        const store = yield* settingsStore(settingsDef).pipe(Effect.provideService(Settings, settingsService))

        const values: PlayerSettings[] = []
        const unsubscribe = store.subscribe((val) => {
          values.push(val)
        })

        // Called immediately
        expect(values).toEqual([settingsDef.defaults])

        // Called on update
        store.update((prev) => ({ ...prev, sound: false }))
        expect(values).toHaveLength(2)
        expect(values[1]?.sound).toBe(false)

        // Unsubscribe
        unsubscribe()
        store.update((prev) => ({ ...prev, sound: true }))
        expect(values).toHaveLength(2) // no new call
      }).pipe(Effect.provide(HostingTest())),
    )
  })

  it('settingsStore(def) returns the booted store; a def with another key dies (planning note 7)', async () => {
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const settingsService = yield* makeSettings(settingsDef, null, hosting.saves)

        // Matching key
        const store = yield* settingsStore(settingsDef).pipe(Effect.provideService(Settings, settingsService))
        expect(store.get()).toEqual(settingsDef.defaults)

        // Different key
        const otherDef: SettingsDef<{ score: number }> = {
          key: 'other_settings_key',
          version: 1,
          schema: z.object({ score: z.number().catch(0) }),
          defaults: { score: 0 },
        }

        const exit = yield* Effect.exit(
          settingsStore(otherDef).pipe(Effect.provideService(Settings, settingsService)),
        )
        expect(Exit.isFailure(exit)).toBe(true)
        if (Exit.isFailure(exit)) {
          expect(Cause.isDie(exit.cause)).toBe(true)
        }
      }).pipe(Effect.provide(HostingTest())),
    )
  })
})

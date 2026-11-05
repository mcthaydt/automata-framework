import type { FlowGraph } from '@mcthaydt/automata-content'
import type { Sim } from '@mcthaydt/automata-sim'
import { settle } from '@ruken/sdk-host/testing'
import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { CompiledContentData } from '#src/app/boot/game-definition.ts'
import { Flow } from '#src/app/flow/flow.manager.ts'
import type { ScreenDef } from '#src/app/flow/screen.ts'
import { Assets } from '#src/shared/runtime/assets.manager.ts'
import { AppLoop } from '#src/shared/runtime/loop/app-loop.manager.ts'
import { PresentationBus } from '#src/shared/runtime/presentation/presentation-bus.manager.ts'
import { Renderer } from '#src/shared/runtime/render/renderer.ts'
import { Settings, settingsStore } from '#src/shared/runtime/settings/settings.manager.ts'
import { Time } from '#src/shared/runtime/time/time.manager.ts'
import { manualFrames } from '#src/testing/runtime/manual-frames.ts'
import { RuntimeTest } from '#src/testing/runtime/ruken/runtime-test.ts'
import { Hosting } from '../../../../../src/shared/host/hosting.ts'
import { FakeHostHandle } from '../../../../../src/testing/host/page/ruken/hosting-test.ts'

describe('RuntimeTest (§3.1 ./testing)', () => {
  it('a test screen yields every RuntimeServices tag and FakeHostHandle; fake host saw hello; Settings holds defaults; AppLoop steps on manualFrames', () =>
    Effect.gen(function* () {
      const frames = manualFrames()
      const yieldedTags: string[] = []
      let settingsValue: { volume: number; mute: boolean } | undefined
      let steppedSim = 0

      const testFlow: FlowGraph = {
        entry: 'test-screen',
        screens: ['test-screen'],
        terminal: [],
        transitions: [],
      }

      const content: CompiledContentData = {
        flow: testFlow,
        game: {
          source_language: 'en',
          rating: 'everyone',
          descriptors: [],
          custom_events: ['test_event'],
          preload_screens: ['test-screen'],
        },
      }

      const testSettingsDef = {
        key: 'test_settings',
        version: 1,
        schema: z.object({
          volume: z.number().catch(80),
          mute: z.boolean().catch(false),
        }),
        defaults: { volume: 80, mute: false },
      }

      const testScreen: ScreenDef<FakeHostHandle> = {
        id: 'test-screen',
        enter: (_ctx) =>
          Effect.gen(function* () {
            // 1. Yield every RuntimeServices tag + FakeHostHandle
            const hosting = yield* Hosting
            if (hosting) yieldedTags.push('Hosting')

            const bus = yield* PresentationBus
            if (bus) yieldedTags.push('PresentationBus')

            const time = yield* Time
            if (time) yieldedTags.push('Time')

            const flow = yield* Flow
            if (flow) yieldedTags.push('Flow')

            const settings = yield* Settings
            if (settings) yieldedTags.push('Settings')

            const appLoop = yield* AppLoop
            if (appLoop) yieldedTags.push('AppLoop')

            const assets = yield* Assets
            if (assets) yieldedTags.push('Assets')

            const renderer = yield* Renderer
            if (renderer) yieldedTags.push('Renderer')

            const fakeHost = yield* FakeHostHandle
            if (fakeHost) yieldedTags.push('FakeHostHandle')

            // 2. Settings holds defaults
            const store = yield* settingsStore(testSettingsDef)
            settingsValue = store.get()

            // 3. AppLoop steps on manualFrames
            const dummySim = {
              tick: 0,
              tickHz: 60,
              step: () => {
                steppedSim++
                return { tick: steppedSim, events: [] }
              },
            }
            appLoop.run({ sim: dummySim as unknown as Sim, commands: () => [] })
            frames.advance(16.67)
          }),
      }

      // Run under RuntimeTest layer
      yield* Effect.gen(function* () {
        const flow = yield* Flow
        const fakeHost = yield* FakeHostHandle

        // Wait until flow is settled (entry screen entered)
        yield* flow.settled

        // Verify fake host saw hello
        const hellos = fakeHost.sentByGame('hello')
        expect(hellos.length).toBeGreaterThanOrEqual(1)

        // Verify all 9 tags were yielded
        expect(yieldedTags.sort()).toEqual([
          'AppLoop',
          'Assets',
          'FakeHostHandle',
          'Flow',
          'Hosting',
          'PresentationBus',
          'Renderer',
          'Settings',
          'Time',
        ])

        // Verify Settings holds defaults
        expect(settingsValue).toEqual({ volume: 80, mute: false })

        // Verify AppLoop stepped
        expect(steppedSim).toBeGreaterThanOrEqual(1)
      }).pipe(
        Effect.provide(
          RuntimeTest({
            screens: [testScreen],
            content,
            settings: testSettingsDef,
            frames,
          }),
        ),
      )
    }).pipe(Effect.runPromise))

  // M5.2: a settings field the game keeps on the device (M5 spec §4.5) goes to the device storage the test hands
  // over, or to memory, and never to the browser's own storage a test run shares.
  it('keeps device fields in the deviceStorage option, or in memory, and out of the saves', () =>
    Effect.gen(function* () {
      const held = new Map<string, string>()
      const device = {
        get: (key: string) => held.get(key) ?? null,
        set: (key: string, value: string) => void held.set(key, value),
        remove: (key: string) => void held.delete(key),
      }
      const def = {
        key: 'prefs',
        version: 1,
        schema: z.object({ mute: z.boolean().catch(false), name: z.string().catch('') }),
        defaults: { mute: false, name: '' },
        deviceFields: ['mute' as const],
      }
      const run = (deviceStorage?: typeof device) =>
        Effect.gen(function* () {
          const store = yield* settingsStore(def)
          store.update((value) => ({ ...value, mute: true, name: 'Kite' }))
          yield* Effect.promise(() => settle(2))
          const { host } = yield* FakeHostHandle
          return host.messages
            .filter((entry) => entry.dir === 'in' && entry.msg.type === 'saves.set')
            .map((entry) => (entry.msg.payload as { value: string }).value)
        }).pipe(Effect.provide(RuntimeTest({ settings: def, ...(deviceStorage ? { deviceStorage } : {}) })))

      const sent = yield* run(device)
      expect(JSON.parse(held.get('prefs:device') ?? 'null')).toEqual({ version: 1, mute: true })
      expect(sent).toEqual([JSON.stringify({ version: 1, name: 'Kite' })])

      const sentToMemory = yield* run()
      expect(sentToMemory).toEqual([JSON.stringify({ version: 1, name: 'Kite' })])
      expect(globalThis.localStorage?.length ?? 0).toBe(0)
    }).pipe(Effect.runPromise))
})

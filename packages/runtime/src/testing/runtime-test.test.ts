import type { FlowGraph } from '@mcthaydt/automata-content'
import { Hosting } from '@mcthaydt/automata-host'
import { FakeHostHandle } from '@mcthaydt/automata-host/testing'
import type { Sim } from '@mcthaydt/automata-sim'
import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { CompiledContentData } from '../boot/game-definition.js'
import { Flow } from '../flow/flow.manager.js'
import type { ScreenDef } from '../flow/screen.js'
import { Assets } from '../loading/assets.manager.js'
import { AppLoop } from '../loop/app-loop.manager.js'
import { PresentationBus } from '../presentation/presentation-bus.manager.js'
import { Renderer } from '../render/renderer.js'
import { Settings, settingsStore } from '../settings/settings.manager.js'
import { Time } from '../time/time.manager.js'
import { manualFrames } from './manual-frames.js'
import { RuntimeTest } from './runtime-test.js'

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
    }))
})

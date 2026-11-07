import type { FlowGraph } from '@mcthaydt/automata-content'
import type { Sim } from '@mcthaydt/automata-sim'
import { settle } from '@ruken/sdk-host/testing'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { CompiledContentData } from '#src/app/boot/game-definition.ts'
import type { ScreenDef } from '#src/app/flow/screen.ts'
import { settingsStore } from '#src/shared/runtime/settings/settings.manager.ts'
import { manualFrames } from '#src/testing/runtime/manual-frames.ts'
import { withRuntimeTest } from '#src/testing/runtime/ruken/runtime-test.ts'

describe('withRuntimeTest (./testing)', () => {
  it('a test screen is handed every runtime service and the test the host handle; fake host saw hello; Settings holds defaults; AppLoop steps on manualFrames', () =>
    (async () => {
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

      const testScreen: ScreenDef = {
        id: 'test-screen',
        enter: (context) => {
          // 1. Every runtime service is handed to the screen
          const hosting = context.services.hosting
          if (hosting) yieldedTags.push('Hosting')

          const bus = context.services.bus
          if (bus) yieldedTags.push('PresentationBus')

          const time = context.services.time
          if (time) yieldedTags.push('Time')

          const flow = context.services.flow
          if (flow) yieldedTags.push('Flow')

          const settings = context.services.settings
          if (settings) yieldedTags.push('Settings')

          const appLoop = context.services.appLoop
          if (appLoop) yieldedTags.push('AppLoop')

          const assets = context.services.assets
          if (assets) yieldedTags.push('Assets')

          const renderer = context.services.renderer
          if (renderer) yieldedTags.push('Renderer')

          // 2. Settings holds defaults
          const store = settingsStore(context.services.settings, testSettingsDef)
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
          context.services.appLoop.run({ sim: dummySim as unknown as Sim, commands: () => [] })
          frames.advance(16.67)
        },
      }

      await withRuntimeTest(
        async ({ services, handle: fakeHost }) => {
          // Wait until flow is settled (entry screen entered)
          await services.flow.settled()

          // Verify fake host saw hello
          const hellos = fakeHost.sentByGame('hello')
          expect(hellos.length).toBeGreaterThanOrEqual(1)

          // Verify all 9 tags were yielded
          expect(yieldedTags.sort()).toEqual([
            'AppLoop',
            'Assets',
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
        },
        { screens: [testScreen], content, settings: testSettingsDef, frames },
      )
    })())

  // M5.2: a settings field the game keeps on the device (M5 spec §4.5) goes to the device storage the test hands
  // over, or to memory, and never to the browser's own storage a test run shares.
  it('keeps device fields in the deviceStorage option, or in memory, and out of the saves', () =>
    (async () => {
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
        withRuntimeTest(
          async ({ services, handle: { host } }) => {
            const store = settingsStore(services.settings, def)
            store.update((value) => ({ ...value, mute: true, name: 'Kite' }))
            await settle(2)
            return host.messages
              .filter((entry) => entry.dir === 'in' && entry.msg.type === 'saves.set')
              .map((entry) => (entry.msg.payload as { value: string }).value)
          },
          { settings: def, ...(deviceStorage ? { deviceStorage } : {}) },
        )

      const sent = await run(device)
      expect(JSON.parse(held.get('prefs:device') ?? 'null')).toEqual({ version: 1, mute: true })
      expect(sent).toEqual([JSON.stringify({ version: 1, name: 'Kite' })])

      const sentToMemory = await run()
      expect(sentToMemory).toEqual([JSON.stringify({ version: 1, name: 'Kite' })])
      expect(globalThis.localStorage?.length ?? 0).toBe(0)
    })())
})

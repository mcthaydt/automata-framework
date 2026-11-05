import { settle } from '@ruken/sdk-host/testing'
import { Context, Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  AUDIO_BUS_NAMES,
  AudioBuses,
  actionsForKey,
  audioBusGainsSchema,
  type InputProfile,
  inputProfileSchema,
  PresentationBus,
  type SettingsDef,
  settingsStore,
  typedBus,
} from '#src/entries/from-runtime.ts'
import { defineExtension } from '#src/features/extension/index.ts'
import { RuntimeTest } from '#src/testing/runtime/index.ts'
import { FakeHostHandle } from '../../../../src/testing/host/page/ruken/hosting-test.ts'

// PRODUCT spec §2 F1: every seam a paid extension uses, used here the way game or extension code would, through
// the public entries only (`.`, `./extension`, `./testing`); never a path inside src. The reachability of each
// entry from package.json `exports` is pinned by tooling/api-report's seam test.

interface GameSettings {
  readonly audio: z.output<typeof audioBusGainsSchema>
  readonly controls: InputProfile
}

const gameSettings: SettingsDef<GameSettings> = {
  key: 'settings',
  version: 1,
  schema: z.object({ audio: audioBusGainsSchema, controls: inputProfileSchema }),
  defaults: {
    audio: audioBusGainsSchema.parse({}),
    controls: inputProfileSchema.parse({ id: 'default', bindings: { jump: { keys: ['Space'] } } }),
  },
}

describe('core seams through the public entries', () => {
  it('a game settings schema holds bus gains and a rebindable input profile, saved through the host', async () => {
    await Effect.gen(function* () {
      const store = yield* settingsStore(gameSettings)
      const { sentByGame } = yield* FakeHostHandle
      store.update((settings) => ({
        audio: { ...settings.audio, music: 0.5 },
        controls: inputProfileSchema.parse({ id: 'custom', bindings: { jump: { keys: ['KeyJ'] } } }),
      }))
      yield* Effect.promise(() => settle())

      expect(actionsForKey(store.get().controls, 'KeyJ')).toEqual(['jump'])
      expect(actionsForKey(store.get().controls, 'Space')).toEqual([])
      const saved = sentByGame('saves.set').at(-1) as { key: string; value: string }
      expect(saved.key).toBe('settings')
      expect(JSON.parse(saved.value)).toMatchObject({ version: 1, audio: { music: 0.5 } })
    }).pipe(
      Effect.provide(RuntimeTest({ settings: gameSettings as SettingsDef<unknown> })),
      Effect.scoped,
      Effect.runPromise,
    )
  })

  it("a game's own facts travel the presentation bus next to the runtime's", async () => {
    await Effect.gen(function* () {
      const bus = typedBus<{ readonly 'score.changed': { readonly score: number } }>(yield* PresentationBus)
      const seen: number[] = []
      const stop = bus.subscribe('score.changed', (fact) => seen.push(fact.score))
      bus.publish('score.changed', { score: 3 })
      stop()
      bus.publish('score.changed', { score: 4 })
      expect(seen).toEqual([3])
    }).pipe(Effect.provide(RuntimeTest()), Effect.scoped, Effect.runPromise)
  })

  it('an extension is declared with defineExtension, and the audio buses are a tag it can be given', () => {
    const extension = defineExtension({ name: 'chime' })
    expect(extension.name).toBe('chime')
    expect(AUDIO_BUS_NAMES).toContain('music')
    const context = Context.empty().pipe(
      Context.add(AudioBuses, {
        input: () => ({}) as AudioNode,
        gain: () => 1,
        setGain: () => undefined,
      }),
    )
    expect(Context.getOption(context, AudioBuses)._tag).toBe('Some')
  })
})

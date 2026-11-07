import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { playEventSounds } from '#src/features/audio/event-sounds.ts'
import { makePresentationBus } from '#src/shared/runtime/presentation/presentation-bus.manager.ts'
import { runScoped } from '../../../src/testing/host/page/run.ts'

// The game's sounds for sim events (M5 spec §4.6: "sim events reach it as presentation-bus facts"): a map from a
// sim event's type to the sound it plays, read on every `sim.events` fact.

describe('playEventSounds', () => {
  it('plays the mapped sound once per event, on sfx unless the entry names a bus', () =>
    runScoped(
      Effect.gen(function* () {
        const bus = yield* makePresentationBus()
        const played: Array<{ alias: string; options: unknown }> = []
        const stop = playEventSounds(
          bus,
          { sound: (alias, options) => played.push({ alias, options }) },
          {
            chime: 'chime.wav',
            shout: { alias: 'shout.wav', bus: 'voice', gain: 0.5 },
          },
        )
        bus.publish('sim.events', [
          { type: 'chime', payload: {} },
          { type: 'unmapped', payload: {} },
          { type: 'shout', payload: {} },
          { type: 'chime', payload: {} },
        ])
        expect(played).toEqual([
          { alias: 'chime.wav', options: { bus: 'sfx' } },
          { alias: 'shout.wav', options: { bus: 'voice', gain: 0.5 } },
          { alias: 'chime.wav', options: { bus: 'sfx' } },
        ])
        stop()
        bus.publish('sim.events', [{ type: 'chime', payload: {} }])
        expect(played).toHaveLength(3)
      }),
    ))
})

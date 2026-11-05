// The game's sounds for sim events: sim events reach audio as presentation-bus facts, never the
// other way round, so audio can never change what the sim does.
import type { PresentationBus } from '../../shared/runtime/presentation/presentation-bus.manager.js'
import type { Audio, SoundOptions } from './audio.manager.js'
import type { AudioBusName } from './audio-buses.js'

/** A sim event's type (its `defineEvent` id) → the asset path it plays, or the path with its bus and gain. */
export type EventSounds = Readonly<
  Record<string, string | { readonly alias: string; readonly bus?: AudioBusName; readonly gain?: number }>
>

/** Plays the mapped sound for each sim event, once per event; returns the unsubscribe. */
export function playEventSounds(
  bus: PresentationBus,
  audio: Pick<Audio, 'sound'>,
  sounds: EventSounds,
): () => void {
  const map = new Map(Object.entries(sounds))
  return bus.subscribe('sim.events', (events) => {
    for (const event of events) {
      const entry = map.get(event.type)
      if (entry === undefined) continue
      if (typeof entry === 'string') {
        audio.sound(entry, { bus: 'sfx' })
        continue
      }
      const options: SoundOptions = {
        bus: entry.bus ?? 'sfx',
        ...(entry.gain === undefined ? {} : { gain: entry.gain }),
      }
      audio.sound(entry.alias, options)
    }
  })
}

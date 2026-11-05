import { Context } from 'effect'
import type { AudioBusName } from './audio-buses.schema.js'

export type { AudioBusName } from './audio-buses.schema.js'

/**
 * The audio-bus seam. Core audio implements it over Web Audio (a gain node per bus
 * into `master`, combined there with `Hosting.audio`'s volume and focus); an extension such as Plus
 * `audio-stream`, or the game, connects its sources to `input(bus)` and never to the destination directly,
 * so the player's gains and the host's ducking always apply.
 */
export interface AudioBuses {
  /** The node a source connects to so that it plays on `bus`. */
  input(bus: AudioBusName): AudioNode
  /** The player's current gain for `bus`, 0..1. */
  gain(bus: AudioBusName): number
  /** Sets the player's gain for `bus`, 0..1. Persisting it is the game's settings' job. */
  setGain(bus: AudioBusName, gain: number): void
}

/** The `AudioBuses` service tag. The Audio service implements it. */
export const AudioBuses: Context.Tag<AudioBuses, AudioBuses> = Context.GenericTag<AudioBuses>(
  '@mcthaydt/automata-runtime/AudioBuses',
)

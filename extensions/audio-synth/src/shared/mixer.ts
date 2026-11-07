// The mixer: a cue plays on its core bus, a world cue is panned and
// attenuated from the listener, and a cue on a bus that other buses duck for takes them down. Core's audio graph owns the one
// context, the buses (their levels, the master and the host's gain) and the ducks' envelopes; this plays *into* them through a
// port the game builds from core's `AudioBuses` and `Audio`, and never makes a context or a bus of its own.
import type { BusId, Cue, DuckRule } from './audio.schema'
import { cueLength, playCue } from './synth'

/** What the mixer needs of core: a node to connect a source to for a bus, and a duck. */
export interface MixerPort {
  /** `AudioBuses.input(bus)`: the node a source connects to so that it plays on `bus`. */
  input(bus: BusId): AudioNode
  /** `Audio.duck(bus, amount, seconds)`: takes `bus` down by `amount` (0..1) for `seconds`. */
  duck(bus: BusId, amount: number, seconds: number): void
}

/** Where the ears are: the camera's ground position and yaw (0 looks toward −z, right is +x). */
export interface Listener {
  readonly x: number
  readonly z: number
  readonly yaw: number
}
/**
 * How a world sound reaches the listener: a pan from -0.8 (left) to 0.8 (right) and a gain that
 * falls with distance.
 */
export interface Spatial {
  readonly pan: number
  readonly gain: number
}
/** Distance model: full level within `ref` metres, then ref / (ref + rolloff · (d − ref)). */
export const DISTANCE: { readonly ref: number; readonly rolloff: number } = { ref: 2, rolloff: 0.6 }
/** How far a sound fully to one side pans (1 would silence the other ear). */
export const PAN_WIDTH = 0.8

/** Pan and distance gain of a world sound at `at` for `listener`. */
export function spatial(listener: Listener, at: { readonly x: number; readonly z: number }): Spatial {
  const dx = at.x - listener.x
  const dz = at.z - listener.z
  const d = Math.hypot(dx, dz)
  const pan =
    d < 1e-6
      ? 0
      : PAN_WIDTH * Math.max(-1, Math.min(1, (dx * Math.cos(listener.yaw) + dz * Math.sin(listener.yaw)) / d))
  const gain = d <= DISTANCE.ref ? 1 : DISTANCE.ref / (DISTANCE.ref + DISTANCE.rolloff * (d - DISTANCE.ref))
  return { pan, gain }
}

/** Turns decibels into a gain multiplier: -6 dB is about half. */
export const dbToGain = (db: number): number => 10 ** (db / 20)

/**
 * How to play one cue: where it sounds, when to start it in audio-context seconds, a random source
 * and how long it holds a duck.
 */
export interface PlayOptions {
  readonly at?: { readonly x: number; readonly z: number } | undefined
  /** Context seconds; now by default. */
  readonly when?: number | undefined
  readonly random?: (() => number) | undefined
  /** Seconds the cue holds a duck; the cue's length by default. */
  readonly length?: number | undefined
}
/**
 * Plays cues on their buses with ducking and, for world cues, panning and distance. `listener`
 * says where the ears are.
 */
export interface Mixer {
  play(cue: Cue, options?: PlayOptions): void
  listener(l: Listener | null): void
}
/** What `createMixer` needs: the port into the game's audio buses and the ducking rules. */
export interface MixerOptions {
  readonly port: MixerPort
  readonly ducks: readonly DuckRule[]
}

/**
 * Makes a mixer that plays into the buses the game already has. It never makes an audio context or
 * a bus of its own.
 */
export function createMixer({ port, ducks }: MixerOptions): Mixer {
  let ears: Listener | null = null
  return {
    play(cue, options = {}) {
      let into: AudioNode = port.input(cue.bus)
      const ctx = into.context as BaseAudioContext
      const when = options.when ?? ctx.currentTime
      if (cue.world === true && options.at !== undefined && ears !== null) {
        const { pan, gain } = spatial(ears, options.at)
        const g = ctx.createGain()
        const p = ctx.createStereoPanner()
        g.gain.value = gain
        p.pan.value = pan
        g.connect(p).connect(into)
        into = g
      }
      playCue(ctx, into, cue, when, options.random)
      if (cue.no_duck === true) return
      const length = options.length ?? cueLength(cue)
      for (const rule of ducks)
        if (rule.bus === cue.bus)
          for (const bus of rule.duck) port.duck(bus, 1 - dbToGain(rule.db), Math.max(rule.attack, length))
    },
    listener(l) {
      ears = l
    },
  }
}

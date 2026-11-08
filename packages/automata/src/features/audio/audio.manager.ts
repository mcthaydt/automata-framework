// The Audio service: the graph, its unlock, sleep and wake, the host's gain, one-shots,
// music and ducks, behind one service that also implements the `AudioBuses` seam.
//
// Audio is presentation: it never feeds the sim, and `sound` is a plain call that allocates nothing, so a game
// can call it from a presentation-bus listener every frame.

import type { Hosting } from '../../shared/host/hosting.ts'
import type { AudioChange, LifecyclePayload } from '../../shared/host/index.ts'
import type { Result } from '../../shared/lib/result.ts'
import { ok, refused } from '../../shared/lib/result.ts'
import { type Listenable, type Subscribable, state } from '../../shared/lib/subscribable.ts'
import type { Assets } from '../../shared/runtime/assets.manager.js'
import { AssetLoadFailed } from '../../shared/runtime/boot-error.js'
import type { PresentationBus } from '../../shared/runtime/presentation/presentation-bus.manager.js'
import type { AudioBuses, AudioBusName } from './audio-buses.js'
import { AudioDecodeFailed } from './audio-error.js'
import { type AudioContextLike, AudioGraph } from './audio-graph.js'
import { type MusicOptions, MusicSlot } from './audio-music.js'
import { Voices } from './audio-voices.js'

/** Options for `Audio.sound`: the bus (default `sfx`), a gain and a playback rate. */
export interface SoundOptions {
  /** `sfx` by default. */
  readonly bus?: AudioBusName
  readonly gain?: number
  readonly rate?: number
}

/**
 * The audio service: one-shot sounds and looping music on the audio buses, unlocked by the
 * first gesture after `session.ready`; the game runs silent when no audio context can be built.
 */
export interface Audio {
  /** False until the first gesture after `session.ready` builds and resumes the graph. */
  readonly unlocked: Subscribable<boolean>
  /** False once a context could not be built (`audio.unavailable`): the game runs silent, and Settings says so. */
  readonly available: Subscribable<boolean>
  /** Plays the asset at `alias` once. Fire and forget: silent before the unlock, while asleep, or if it fails. */
  sound(alias: string, options?: SoundOptions): void
  /**
   * Loops the asset at `alias` on the music bus. Asked for before the unlock, it starts on the unlock (and answers at
   * once). A file that is missing or is not audio is an answer, not a throw: the game plays on without that music.
   */
  music(alias: string, options?: MusicOptions): Promise<Result<void, AudioDecodeFailed | AssetLoadFailed>>
  /** Fades the music out over `fadeSeconds`, a click-free cut by default. */
  stopMusic(fadeSeconds?: number): void
  /** Takes `bus` down by `amount` (0..1) for `seconds`; `master` ducks every bus. */
  duck(bus: AudioBusName, amount: number, seconds: number): void
  /** The player's mute: the master only, so unmuting restores the mix as it was. */
  setMuted(muted: boolean): void
  /**
   * A short tone on `bus`, as the volume sliders play on release, so the player hears the level
   * they set. The graph makes it: no game asset. Silent before the unlock, as every sound is.
   */
  sample(bus: AudioBusName): void
  /** The player's "mute when in the background": silences the master while another window has focus. */
  setMuteUnfocused(muteUnfocused: boolean): void
}

/** Options for the audio service; each has a browser default, replaced in tests. */
export interface AudioOptions {
  /** Builds the context on the unlock. Defaults to `new AudioContext()`. */
  readonly createContext?: () => AudioContextLike
  /** Where gestures, `blur` and `focus` land. Defaults to `window`. */
  readonly window?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>
  /** Whose `visibilitychange` sleeps and wakes the graph. Defaults to `document`. */
  readonly document?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'> & {
    readonly visibilityState: DocumentVisibilityState
  }
  /** Silences the master while another window has focus; the graph keeps running. */
  readonly muteUnfocused?: boolean
  /** Loads a file no screen preloaded. Defaults to `fetch`. */
  readonly fetch?: typeof fetch
}

/** What the service reads from the runtime. */
export interface AudioServices {
  /** Gestures before `ready` are ignored; `lifecycle` and `audio` are only listened to. */
  readonly hosting: Pick<Hosting, 'ready'> & {
    readonly lifecycle: Listenable<LifecyclePayload>
    readonly audio: Listenable<AudioChange>
  }
  readonly assets: Pick<Assets, 'get'>
  readonly bus: PresentationBus
}

/** How long the volume sample sounds, and its pitch: short and mid, heard on every bus without being a sound effect. */
const TONE_SECONDS = 0.12
const TONE_HERTZ = 660

/**
 * The volume sample: a sine that falls away to silence, so it ends without
 * a click. Made in the graph's own context, so it needs no asset and no decode.
 */
function makeTone(context: Pick<AudioContextLike, 'createBuffer' | 'sampleRate'>): AudioBuffer {
  const length = Math.round(context.sampleRate * TONE_SECONDS)
  const buffer = context.createBuffer(1, length, context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let index = 0; index < length; index += 1) {
    const fade = 1 - index / length
    data[index] = 0.4 * fade * fade * Math.sin((2 * Math.PI * TONE_HERTZ * index) / context.sampleRate)
  }
  return buffer
}

/** The gestures that may unlock audio, in the capture phase so a handler that stops propagation cannot hide one. */
const GESTURES = ['pointerdown', 'keydown', 'touchend'] as const

const reason = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause))

/**
 * Builds the Audio service, which is also the `AudioBuses` seam. Nothing is built until the first gesture after
 * the session is ready; `dispose()` stops every sound, closes the context and removes every listener.
 */
export function createAudio(options: AudioServices & AudioOptions): Audio & AudioBuses & { dispose(): void } {
  const { hosting, assets, bus } = options
  const target = options.window ?? globalThis.window
  const page = options.document ?? globalThis.document
  const load = options.fetch ?? globalThis.fetch
  const createContext = options.createContext ?? (() => new AudioContext())

  const graph = new AudioGraph()
  const voices = new Voices(graph)
  const music = new MusicSlot(graph)
  const unlocked = state(false)
  const available = state(true)
  const decoded = new Map<string, Promise<AudioBuffer>>()
  let ready = false
  let unavailable = false
  let disposed = false
  /** Music asked for before the unlock, started by it. */
  let waitingMusic: { readonly alias: string; readonly options: MusicOptions } | undefined

  const giveUp = (cause: unknown) => {
    unavailable = true
    available.set(false)
    bus.publish('audio.unavailable', { reason: reason(cause) })
  }

  /** The asset's bytes, preloaded or fetched, decoded once per alias; rejects with the failure's error. */
  const decode = (alias: string): Promise<AudioBuffer> => {
    const known = decoded.get(alias)
    if (known !== undefined) return known
    const context = graph.context
    if (context === undefined) return Promise.reject(new Error('audio is not unlocked'))
    const pending = (async () => {
      let blob = assets.get(alias)
      if (blob === undefined) {
        const response = await load(alias).catch(() => undefined)
        if (response === undefined || !response.ok)
          throw new AssetLoadFailed({ url: alias, status: response?.status ?? 0 })
        blob = await response.blob()
      }
      const bytes = await blob.arrayBuffer()
      try {
        return await context.decodeAudioData(bytes)
      } catch (cause) {
        throw new AudioDecodeFailed({ alias, cause })
      }
    })()
    pending.catch((error: unknown) =>
      bus.publish('audio.decode.failed', {
        alias,
        reason: error instanceof AudioDecodeFailed ? reason(error.cause) : reason(error),
      }),
    )
    decoded.set(alias, pending)
    return pending
  }

  const playMusic = (
    alias: string,
    musicOptions: MusicOptions,
  ): Promise<Result<void, AudioDecodeFailed | AssetLoadFailed>> =>
    decode(alias).then(
      (buffer) => ok(music.play(buffer, musicOptions)),
      (error: unknown) =>
        refused(
          error instanceof AssetLoadFailed || error instanceof AudioDecodeFailed
            ? error
            : new AudioDecodeFailed({ alias, cause: error }),
        ),
    )

  const onUnlocked = () => {
    if (disposed) return
    unlocked.set(true)
    bus.publish('audio.unlocked', {})
    const waiting = waitingMusic
    waitingMusic = undefined
    if (waiting !== undefined) void playMusic(waiting.alias, waiting.options)
  }

  /**
   * The first gesture after `ready` builds and resumes the graph; later ones resume a graph the system stopped.
   * Both calls happen inside the browser's gesture, before any await.
   */
  const onGesture = () => {
    if (!ready || unavailable || disposed) return
    if (graph.context !== undefined) {
      void graph.resumeOnGesture().catch(() => undefined)
      return
    }
    try {
      graph.buildIfNeeded(createContext)
    } catch (cause) {
      giveUp(cause)
      return
    }
    graph.resumeUnlessRunning().then(onUnlocked, giveUp)
  }

  const sleep = () => {
    voices.cancelPending()
    void graph.sleep().catch(() => undefined)
  }
  const wake = () => void graph.wake().catch(() => undefined)
  const onVisibility = () => (page.visibilityState === 'hidden' ? sleep() : wake())
  // The window's focus is always followed; the master goes silent on a blur only while the setting is on.
  let muteUnfocused = options.muteUnfocused === true
  let blurred = false
  const onBlur = () => {
    blurred = true
    graph.setUnfocused(muteUnfocused)
  }
  const onFocus = () => {
    blurred = false
    graph.setUnfocused(false)
  }

  for (const type of GESTURES) target.addEventListener(type, onGesture, { capture: true, passive: true })
  page.addEventListener('visibilitychange', onVisibility)
  target.addEventListener('blur', onBlur)
  target.addEventListener('focus', onFocus)

  // A refused ready leaves the gestures ignored: the session never started, so neither does sound.
  void hosting.ready.then((result) => {
    if (result.ok && !disposed) ready = true
  })
  // The host's volume, focus and ads arrive already combined in `gain`: multiply the mix by it, add nothing.
  const stopGain = hosting.audio.subscribe((change) => graph.setHostGain(change.gain))
  // Only a hidden page sleeps: a blurred window or the host's drawer keeps playing;
  // `muteUnfocused` covers a player who wants quiet then.
  const stopLifecycle = hosting.lifecycle.subscribe((lifecycle) => {
    if (lifecycle.state === 'active') wake()
    else if (lifecycle.reasons.includes('hidden')) sleep()
  })

  const dispose = () => {
    if (disposed) return
    disposed = true
    stopGain()
    stopLifecycle()
    for (const type of GESTURES) target.removeEventListener(type, onGesture, { capture: true })
    page.removeEventListener('visibilitychange', onVisibility)
    target.removeEventListener('blur', onBlur)
    target.removeEventListener('focus', onFocus)
    voices.stopAll()
    music.stop()
    void graph.context?.close().catch(() => undefined)
  }

  /** The volume sample's tone, made once on its first use and kept with the context. */
  let tone: AudioBuffer | undefined

  const audio: Audio & AudioBuses & { dispose(): void } = {
    unlocked,
    available,
    sound(alias, soundOptions = {}) {
      if (unavailable || graph.context === undefined) return
      void voices.play(() => decode(alias).catch(() => undefined), {
        bus: soundOptions.bus ?? 'sfx',
        ...(soundOptions.gain === undefined ? {} : { gain: soundOptions.gain }),
        ...(soundOptions.rate === undefined ? {} : { rate: soundOptions.rate }),
      })
    },
    sample(bus) {
      const context = graph.context
      if (unavailable || context === undefined) return
      tone ??= makeTone(context)
      const made = tone
      void voices.play(async () => made, { bus })
    },
    music(alias, musicOptions = {}) {
      if (unavailable) return Promise.resolve(ok(undefined))
      if (graph.context === undefined) {
        waitingMusic = { alias, options: musicOptions }
        return Promise.resolve(ok(undefined))
      }
      return playMusic(alias, musicOptions)
    },
    stopMusic(fadeSeconds) {
      waitingMusic = undefined
      music.stop(fadeSeconds)
    },
    duck: (duckBus, amount, seconds) => graph.duck(duckBus, amount, seconds),
    setMuted: (muted) => graph.setMuted(muted),
    setMuteUnfocused: (next) => {
      muteUnfocused = next
      graph.setUnfocused(next && blurred)
    },
    input(inputBus) {
      const node = graph.input(inputBus)
      if (node === undefined)
        throw new Error(`audio is not unlocked yet: connect to '${inputBus}' once Audio.unlocked is true`)
      return node
    },
    gain: (gainBus) => graph.gain(gainBus),
    setGain: (gainBus, value) => graph.setGain(gainBus, value),
    dispose,
  }
  return audio
}

// The Audio service (M5 spec §4.6, §5, §6): the graph, its unlock, sleep and wake, the host's gain, one-shots,
// music and ducks, behind one service that also implements PRODUCT.1's `AudioBuses` seam. The rules come from
// FloorFifty `apps/client/src/managers/audio/engine.ts` and `ui/sleep-when-hidden.ts` at `ac72660`.
//
// Audio is presentation: it never feeds the sim, and `sound` is a plain call that allocates no Effect, so a game
// can call it from a presentation-bus listener every frame.
import { Hosting } from '@mcthaydt/automata-host'
import { Context, Effect, Layer, type Scope, Stream, type Subscribable, SubscriptionRef } from 'effect'
import { AssetLoadFailed } from '../boot/boot-error.js'
import { Assets } from '../loading/assets.manager.js'
import { PresentationBus } from '../presentation/presentation-bus.manager.js'
import { AudioBuses, type AudioBusName } from './audio-buses.js'
import { AudioDecodeFailed } from './audio-error.js'
import { type AudioContextLike, AudioGraph } from './audio-graph.js'
import { type MusicOptions, MusicSlot } from './audio-music.js'
import { Voices } from './audio-voices.js'

export interface SoundOptions {
  /** `sfx` by default. */
  readonly bus?: AudioBusName
  readonly gain?: number
  readonly rate?: number
}

export interface Audio {
  /** False until the first gesture after `session.ready` builds and resumes the graph. */
  readonly unlocked: Subscribable.Subscribable<boolean>
  /** Plays the asset at `alias` once. Fire and forget: silent before the unlock, while asleep, or if it fails. */
  sound(alias: string, options?: SoundOptions): void
  /** Loops the asset at `alias` on the music bus. Asked for before the unlock, it starts on the unlock. */
  music(alias: string, options?: MusicOptions): Effect.Effect<void, AudioDecodeFailed | AssetLoadFailed>
  /** Fades the music out over `fadeSeconds`, a click-free cut by default. */
  stopMusic(fadeSeconds?: number): void
  /** Takes `bus` down by `amount` (0..1) for `seconds`; `master` ducks every bus. */
  duck(bus: AudioBusName, amount: number, seconds: number): void
  /** The player's mute: the master only, so unmuting restores the mix as it was. */
  setMuted(muted: boolean): void
}

export const Audio: Context.Tag<Audio, Audio> = Context.GenericTag<Audio>('@mcthaydt/automata-runtime/Audio')

export interface AudioOptions {
  /** Builds the context on the unlock. Defaults to `new AudioContext()`. */
  readonly createContext?: () => AudioContextLike
  /** Where gestures, `blur` and `focus` land. Defaults to `window`. */
  readonly window?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>
  /** Whose `visibilitychange` sleeps and wakes the graph. Defaults to `document`. */
  readonly document?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'> & {
    readonly visibilityState: DocumentVisibilityState
  }
  /** Silences the master while another window has focus (FloorFifty's setting); the graph keeps running. */
  readonly muteUnfocused?: boolean
  /** Loads a file no screen preloaded. Defaults to `fetch`. */
  readonly fetch?: typeof fetch
}

/** What the service reads from the runtime. */
export interface AudioServices {
  readonly hosting: Pick<Hosting, 'ready' | 'lifecycle' | 'audio'>
  readonly assets: Pick<Assets, 'get'>
  readonly bus: PresentationBus
}

/** The gestures that may unlock audio, in the capture phase so a handler that stops propagation cannot hide one. */
const GESTURES = ['pointerdown', 'keydown', 'touchend'] as const

const reason = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause))

/**
 * Builds the Audio service, which is also the `AudioBuses` seam. Nothing is built until the first gesture after
 * the session is ready; closing the scope stops every sound, closes the context and removes every listener.
 */
export const makeAudio = (
  options: AudioServices & AudioOptions,
): Effect.Effect<Audio & AudioBuses, never, Scope.Scope> =>
  Effect.gen(function* () {
    const { hosting, assets, bus } = options
    const target = options.window ?? globalThis.window
    const page = options.document ?? globalThis.document
    const load = options.fetch ?? globalThis.fetch
    const createContext = options.createContext ?? (() => new AudioContext())

    const graph = new AudioGraph()
    const voices = new Voices(graph)
    const music = new MusicSlot(graph)
    const unlocked = yield* SubscriptionRef.make(false)
    const decoded = new Map<string, Promise<AudioBuffer>>()
    let ready = false
    let unavailable = false
    let disposed = false
    /** Music asked for before the unlock, started by it. */
    let waitingMusic: { readonly alias: string; readonly options: MusicOptions } | undefined

    const giveUp = (cause: unknown) => {
      unavailable = true
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

    const playMusic = (alias: string, musicOptions: MusicOptions) =>
      Effect.tryPromise({
        try: () => decode(alias),
        catch: (error) =>
          error instanceof AssetLoadFailed || error instanceof AudioDecodeFailed
            ? error
            : new AudioDecodeFailed({ alias, cause: error }),
      }).pipe(Effect.map((buffer) => music.play(buffer, musicOptions)))

    const onUnlocked = () => {
      if (disposed) return
      Effect.runSync(SubscriptionRef.set(unlocked, true))
      bus.publish('audio.unlocked', {})
      const waiting = waitingMusic
      waitingMusic = undefined
      if (waiting !== undefined) Effect.runFork(Effect.ignore(playMusic(waiting.alias, waiting.options)))
    }

    /**
     * The first gesture after `ready` builds and resumes the graph; later ones resume a graph the system stopped.
     * Both calls happen inside the browser's gesture, before any await (FloorFifty `engine.ts` `unlock`).
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
    const onBlur = () => graph.setUnfocused(true)
    const onFocus = () => graph.setUnfocused(false)

    for (const type of GESTURES) target.addEventListener(type, onGesture, { capture: true, passive: true })
    page.addEventListener('visibilitychange', onVisibility)
    if (options.muteUnfocused === true) {
      target.addEventListener('blur', onBlur)
      target.addEventListener('focus', onFocus)
    }

    yield* Effect.forkScoped(
      hosting.ready.pipe(
        Effect.tap(() => Effect.sync(() => (ready = true))),
        Effect.ignore,
      ),
    )
    // The host's volume, focus and ads arrive already combined in `gain`: multiply the mix by it, add nothing.
    yield* Effect.forkScoped(
      Stream.runForEach(hosting.audio.changes, (change) => Effect.sync(() => graph.setHostGain(change.gain))),
    )
    // Only a hidden page sleeps: a blurred window or the host's drawer keeps playing (FloorFifty
    // `sleepOnHostLifecycle`); `muteUnfocused` covers a player who wants quiet then.
    yield* Effect.forkScoped(
      Stream.runForEach(hosting.lifecycle.changes, (lifecycle) =>
        Effect.sync(() => {
          if (lifecycle.state === 'active') wake()
          else if (lifecycle.reasons.includes('hidden')) sleep()
        }),
      ),
    )

    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        disposed = true
        for (const type of GESTURES) target.removeEventListener(type, onGesture, { capture: true })
        page.removeEventListener('visibilitychange', onVisibility)
        target.removeEventListener('blur', onBlur)
        target.removeEventListener('focus', onFocus)
        voices.stopAll()
        music.stop()
        void graph.context?.close().catch(() => undefined)
      }),
    )

    const audio: Audio & AudioBuses = {
      unlocked,
      sound(alias, soundOptions = {}) {
        if (unavailable || graph.context === undefined) return
        void voices.play(() => decode(alias).catch(() => undefined), {
          bus: soundOptions.bus ?? 'sfx',
          ...(soundOptions.gain === undefined ? {} : { gain: soundOptions.gain }),
          ...(soundOptions.rate === undefined ? {} : { rate: soundOptions.rate }),
        })
      },
      music(alias, musicOptions = {}) {
        if (unavailable) return Effect.void
        if (graph.context === undefined) {
          return Effect.sync(() => {
            waitingMusic = { alias, options: musicOptions }
          })
        }
        return playMusic(alias, musicOptions)
      },
      stopMusic(fadeSeconds) {
        waitingMusic = undefined
        music.stop(fadeSeconds)
      },
      duck: (duckBus, amount, seconds) => graph.duck(duckBus, amount, seconds),
      setMuted: (muted) => graph.setMuted(muted),
      input(inputBus) {
        const node = graph.input(inputBus)
        if (node === undefined)
          throw new Error(`audio is not unlocked yet: connect to '${inputBus}' once Audio.unlocked is true`)
        return node
      },
      gain: (gainBus) => graph.gain(gainBus),
      setGain: (gainBus, value) => graph.setGain(gainBus, value),
    }
    return audio
  })

/** `makeAudio` with its defaults, reading `Hosting`, `Assets` and `PresentationBus` from the runtime. */
export const audioLayer = (
  options: AudioOptions = {},
): Layer.Layer<Audio | AudioBuses, never, Hosting | Assets | PresentationBus> =>
  Layer.scopedContext(
    Effect.gen(function* () {
      const audio = yield* makeAudio({
        ...options,
        hosting: yield* Hosting,
        assets: yield* Assets,
        bus: yield* PresentationBus,
      })
      return Context.make(Audio, audio).pipe(Context.add(AudioBuses, audio))
    }),
  )

/** The Audio service with its defaults: the browser's `AudioContext`, `window`, `document` and `fetch`. */
export const AudioLive: Layer.Layer<Audio | AudioBuses, never, Hosting | Assets | PresentationBus> =
  audioLayer()

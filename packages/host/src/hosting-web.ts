import type {
  AudioChange,
  Capability,
  DisplayMetricsPayload,
  EntitlementsPayload,
  FullscreenRes,
  InputMode,
  InputModePayload,
  LifecyclePayload,
  LifecycleReason,
  StorageLike,
} from '@ruken/sdk'
import { Deferred, Effect, Layer, Option, type Scope } from 'effect'
import { HostError } from './errors'
import { Hosting, type HostingOptions } from './hosting'
import type { HostingSeams } from './hosting-live'
import { fromListener } from './subscribable'

/*
 * The web adapter (PUB spec §3.1): `Hosting` for a page outside Ruken, chosen at build time for the `itch` and
 * `web` targets through `@mcthaydt/automata-host/target` (ADR 0005). It mirrors the SDK's standalone session
 * wherever the SDK defines one and adds what a page can observe. It never falls back to memory for saves: when
 * the browser blocks storage, `saves` is not granted and every call fails `DENIED`.
 *
 * Ruken stays the vocabulary: every type comes from `@ruken/sdk`, imported as types only, so a bundle built with
 * this adapter holds no SDK code (`target.build.test.ts` builds one and checks for `RUKEN_SDK_MARKERS`).
 */

type PageListener = (event: Event) => void

/** Something to listen on: the window, its document or its visual viewport. */
export interface WebEvents {
  addEventListener(type: string, listener: PageListener, options?: AddEventListenerOptions | boolean): void
  removeEventListener(type: string, listener: PageListener, options?: EventListenerOptions | boolean): void
}

/** The parts of the browser page the web adapter reads. The real `window` is one; tests pass a fake. */
export interface WebPage extends WebEvents {
  readonly document: WebEvents & {
    readonly visibilityState: DocumentVisibilityState
    hasFocus(): boolean
    readonly fullscreenEnabled?: boolean
    readonly fullscreenElement: object | null
    exitFullscreen?(): Promise<void>
    readonly documentElement: { requestFullscreen?(): Promise<void> }
  }
  readonly navigator: { readonly language?: string }
  /** Reading it may throw (a frame denied storage), so it is only read inside the probe. */
  readonly localStorage: StorageLike
  readonly visualViewport?: (WebEvents & { readonly width: number; readonly height: number }) | null
  readonly innerWidth: number
  readonly innerHeight: number
  matchMedia?(query: string): { readonly matches: boolean }
}

/** The build's publish target among those that use this adapter (PUB spec §3). */
export type WebTarget = 'itch' | 'web'

/**
 * The storage probe's key. Deliberately not the SDK's `ruken:__probe__`: that string marks SDK code in a bundle
 * (`RUKEN_SDK_MARKERS`), and an itch build must not contain it.
 */
export const WEB_STORAGE_PROBE_KEY = 'automata:storage-probe'

/** The same as the SDK's standalone session (`standalone.ts` at b30d31b): nothing reserved, scale 1. */
const NOTHING_RESERVED: Pick<DisplayMetricsPayload, 'safeArea' | 'hostReserved' | 'scale'> = {
  safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
  hostReserved: { edge: 'right', rect: { x: 0, y: 0, w: 0, h: 0 } },
  scale: 1,
}
const FULL_VOLUME: AudioChange = {
  focus: { state: 'full', reason: 'system' },
  master: { volume: 1, muted: false },
  gain: 1,
}
const NO_ENTITLEMENTS: EntitlementsPayload = { ads: false, items: [], subscriptions: [], devBuild: false }

/** `localStorage` when the browser lets this page write to it, else null. */
function probeStorage(page: WebPage): StorageLike | null {
  try {
    const storage = page.localStorage
    storage.setItem(WEB_STORAGE_PROBE_KEY, '1')
    storage.removeItem(WEB_STORAGE_PROBE_KEY)
    return storage
  } catch {
    return null
  }
}

/** A failed storage call in Ruken's codes. A full origin quota is `QUOTA_EXCEEDED`, as Ruken marks it, not retryable. */
function storageError(operation: string, cause: unknown): HostError {
  const name = cause instanceof DOMException ? cause.name : undefined
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') {
    return new HostError({ code: 'QUOTA_EXCEEDED', retryable: false, operation, cause })
  }
  if (name === 'SecurityError') return new HostError({ code: 'DENIED', retryable: false, operation, cause })
  return new HostError({ code: 'INTERNAL', retryable: true, operation, cause })
}

/** Capture and passive, as the SDK listens for input (`env-browser.ts`): the game's own handlers are untouched. */
const LISTEN: AddEventListenerOptions = { capture: true, passive: true }

/** Calls `onEvent` for each of `types` on `target`, until the returned function is called. */
function listen(target: WebEvents, types: readonly string[], onEvent: PageListener): () => void {
  for (const type of types) target.addEventListener(type, onEvent, LISTEN)
  return () => {
    for (const type of types) target.removeEventListener(type, onEvent, LISTEN)
  }
}

/** A hidden tab or an unfocused page is in the background, so a game that pauses does (PUB spec §3.1). */
function lifecycleOf(page: WebPage): LifecyclePayload {
  const reasons: LifecycleReason[] = []
  if (page.document.visibilityState === 'hidden') reasons.push('hidden')
  if (!page.document.hasFocus()) reasons.push('blurred')
  return { state: reasons.length === 0 ? 'active' : 'background', reasons }
}

function displayOf(page: WebPage): DisplayMetricsPayload {
  const width = page.visualViewport?.width ?? page.innerWidth
  const height = page.visualViewport?.height ?? page.innerHeight
  return {
    ...NOTHING_RESERVED,
    orientation: height > width ? 'portrait' : 'landscape',
    fullscreen: page.document.fullscreenElement !== null,
  }
}

interface InputTracker {
  current(): InputModePayload
  on(onChange: (value: InputModePayload) => void): () => void
  stop(): void
}

/**
 * The last input the player used, from real events (PUB spec §3.1). A phone starts in touch mode. Ruken's host
 * names the gamepad layout itself; outside it, AF reads 'xbox' from the gamepad's id and calls the rest 'other'.
 */
function trackInput(page: WebPage): InputTracker {
  let mode: InputMode = page.matchMedia?.('(pointer: coarse)').matches === true ? 'touch' : 'keyboard-mouse'
  let gamepad: InputModePayload['gamepad']
  const subscribers = new Set<(value: InputModePayload) => void>()
  const current = (): InputModePayload => (gamepad === undefined ? { mode } : { mode, gamepad })
  const update = (nextMode: InputMode, nextGamepad: InputModePayload['gamepad'] = gamepad) => {
    if (nextMode === mode && nextGamepad === gamepad) return
    mode = nextMode
    gamepad = nextGamepad
    const value = current()
    for (const subscriber of subscribers) subscriber(value)
  }
  const layoutOf = (event: Event): 'xbox' | 'other' => {
    const id = (event as { gamepad?: { id?: string } }).gamepad?.id ?? ''
    return /xbox|xinput/i.test(id) ? 'xbox' : 'other'
  }
  const stops = [
    listen(page, ['pointerdown'], (event) =>
      update((event as { pointerType?: string }).pointerType === 'touch' ? 'touch' : 'keyboard-mouse'),
    ),
    listen(page, ['touchstart'], () => update('touch')),
    listen(page, ['keydown', 'wheel'], () => update('keyboard-mouse')),
    listen(page, ['gamepadconnected'], (event) =>
      update('gamepad', { layout: layoutOf(event), connected: true }),
    ),
    listen(page, ['gamepaddisconnected'], (event) =>
      update(mode === 'gamepad' ? 'keyboard-mouse' : mode, { layout: layoutOf(event), connected: false }),
    ),
  ]
  return {
    current,
    on: (onChange) => {
      subscribers.add(onChange)
      return () => void subscribers.delete(onChange)
    },
    stop: () => {
      for (const stop of stops) stop()
    },
  }
}

/**
 * Builds the web adapter over `page`. When the scope closes, Hosting marks itself closed (later calls fail
 * `HostError{code:'CANCELLED'}`), then every observed stream ends, as the Ruken adapter does.
 */
export function makeWebHosting(
  options: HostingOptions,
  page: WebPage,
  target: WebTarget,
): Effect.Effect<Hosting, never, Scope.Scope> {
  return Effect.gen(function* () {
    const shutdown = yield* Deferred.make<void>()
    let open = true
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        open = false
      }).pipe(Effect.zipRight(Deferred.succeed(shutdown, undefined))),
    )
    const whileOpen = <A>(operation: string, request: Effect.Effect<A, HostError>) =>
      Effect.suspend(() =>
        open ? request : Effect.fail(new HostError({ code: 'CANCELLED', retryable: false, operation })),
      )
    const until = Deferred.await(shutdown)
    const constant = <A>(value: A) =>
      fromListener(
        () => value,
        () => () => undefined,
        until,
      )
    /** A value read from the page, reported again when one of `sources` fires and the value has changed. */
    const derived = <A>(
      read: () => A,
      sources: readonly (readonly [WebEvents | null | undefined, readonly string[]])[],
    ) =>
      fromListener(
        read,
        (onChange) => {
          let last = JSON.stringify(read())
          const check = () => {
            const next = read()
            const key = JSON.stringify(next)
            if (key === last) return
            last = key
            onChange(next)
          }
          const stops = sources.flatMap(([target, types]) => (target ? [listen(target, types, check)] : []))
          return () => {
            for (const stop of stops) stop()
          }
        },
        until,
      )
    const input = yield* Effect.acquireRelease(
      Effect.sync(() => trackInput(page)),
      (tracker) => Effect.sync(() => tracker.stop()),
    )

    const storage = probeStorage(page)
    // The SDK's standalone prefix, so a game's saves are the same keys whichever adapter wrote them.
    const prefix = `ruken:${options.gameId}:`
    const granted = new Set<Capability>(['lifecycle', 'input', 'display', 'audio'])
    if (storage !== null) granted.add('saves')
    const withStorage = <A>(operation: string, use: (storage: StorageLike) => A) =>
      whileOpen(
        operation,
        Effect.suspend(() =>
          storage === null
            ? Effect.fail(new HostError({ code: 'DENIED', retryable: false, operation }))
            : Effect.try({ try: () => use(storage), catch: (cause) => storageError(operation, cause) }),
        ),
      )

    const fullscreenRoot = page.document.documentElement
    const fullscreenSupported =
      page.document.fullscreenEnabled === true && fullscreenRoot.requestFullscreen !== undefined

    const hosting: Hosting = {
      kind: 'web',
      hostName: target === 'itch' ? 'itch.io' : 'this page',
      handshake: { fellBack: Option.none() },
      player: { id: 'standalone', displayName: '' },
      locale: page.navigator.language || 'en',
      granted,
      ready: Effect.void,

      lifecycle: derived(
        () => lifecycleOf(page),
        [
          [page.document, ['visibilitychange']],
          [page, ['focus', 'blur']],
        ],
      ),
      input: fromListener(input.current, input.on, until),
      display: derived(
        () => displayOf(page),
        [
          [page.visualViewport, ['resize']],
          [page, ['resize', 'orientationchange']],
          [page.document, ['fullscreenchange']],
        ],
      ),
      audio: constant(FULL_VOLUME),
      entitlements: constant(NO_ENTITLEMENTS),
      savesStatus: constant('saved'),

      saves: {
        get: (key) => withStorage('saves.get', (local) => local.getItem(prefix + key)),
        set: (key, value) => withStorage('saves.set', (local) => local.setItem(prefix + key, value)),
        remove: (key) => withStorage('saves.remove', (local) => local.removeItem(prefix + key)),
        // Writes reach localStorage synchronously, so there is nothing left to hand over. Ruken has no
        // `persisted` value for device storage yet (PUB spec §9 request 3), so this answers as the SDK's
        // standalone session does.
        flush: withStorage('saves.flush', () => ({ persisted: 'host-outbox' as const })),
      },
      // The Element Fullscreen API on the page's root; itch.io's frame allows it. A request the browser
      // refuses (no user gesture, a frame without allowfullscreen) fails DENIED rather than pretending.
      setFullscreen: (on) =>
        whileOpen(
          'display.fullscreen',
          Effect.tryPromise({
            try: async (): Promise<FullscreenRes> => {
              if (!fullscreenSupported) return { fullscreen: false, support: 'none' }
              const active = page.document.fullscreenElement !== null
              if (on && !active) await fullscreenRoot.requestFullscreen?.()
              if (!on && active) await page.document.exitFullscreen?.()
              return { fullscreen: page.document.fullscreenElement !== null, support: 'element' }
            },
            catch: (cause) =>
              new HostError({ code: 'DENIED', retryable: false, operation: 'display.fullscreen', cause }),
          }),
        ),
      round: { start: Effect.void, end: () => Effect.void },
      // Nothing outside Ruken collects analytics. An undisclosed event is still reported, as the Ruken adapter
      // reports it, so a game finds the mistake on any target.
      track: (event) =>
        options.disclosedEvents !== undefined && !options.disclosedEvents.includes(event)
          ? Effect.logWarning(`track("${event}") dropped: not in the game's disclosed analytics events`)
          : Effect.void,
      // There is no host to go back to; the UI hides "Back to …" because `exit` is not granted (PUB spec §3.1).
      exit: () =>
        whileOpen(
          'session.exit',
          Effect.fail(new HostError({ code: 'UNSUPPORTED', retryable: false, operation: 'session.exit' })),
        ),
      // Nothing outside Ruken asks for the game's menu or closes the game, so these are registered and never called.
      onMenuRequest: () => Effect.void,
      onExiting: () => Effect.void,
    }
    return hosting
  })
}

/**
 * The web adapter over the real page, with the same signature as the Ruken adapter's `makeHosting`, so
 * `@mcthaydt/automata-host/target` can swap one for the other. `seams.env` is the Ruken SDK's test seam and
 * means nothing here.
 */
export function makeHosting(
  options: HostingOptions,
  _seams: HostingSeams = {},
): Effect.Effect<Hosting, HostError, Scope.Scope> {
  return makeWebHosting(options, window, 'web')
}

/** The single `Hosting` layer for a web build, as `HostingLive` is for a Ruken build. */
export function HostingLive(
  options: HostingOptions,
  seams: HostingSeams = {},
): Layer.Layer<Hosting, HostError> {
  return Layer.scoped(Hosting, makeHosting(options, seams))
}

import type {
  AudioChange,
  Capability,
  DisplayMetricsPayload,
  EntitlementsPayload,
  FullscreenRes,
  InputModePayload,
  LifecyclePayload,
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
 * this adapter holds no SDK code. Nothing this module imports at run time may import the SDK.
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

function displayOf(page: WebPage): DisplayMetricsPayload {
  const width = page.visualViewport?.width ?? page.innerWidth
  const height = page.visualViewport?.height ?? page.innerHeight
  return {
    ...NOTHING_RESERVED,
    orientation: height > width ? 'portrait' : 'landscape',
    fullscreen: page.document.fullscreenElement !== null,
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
    const constant = <A>(value: A) =>
      fromListener(
        () => value,
        () => () => undefined,
        Deferred.await(shutdown),
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

    const lifecycle: LifecyclePayload = { state: 'active', reasons: [] }
    const input: InputModePayload = { mode: 'keyboard-mouse' }

    const hosting: Hosting = {
      kind: 'web',
      hostName: target === 'itch' ? 'itch.io' : 'this page',
      handshake: { fellBack: Option.none() },
      player: { id: 'standalone', displayName: '' },
      locale: page.navigator.language || 'en',
      granted,
      ready: Effect.void,

      lifecycle: constant(lifecycle),
      input: constant(input),
      display: constant(displayOf(page)),
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
      setFullscreen: () =>
        whileOpen(
          'display.fullscreen',
          Effect.succeed<FullscreenRes>({ fullscreen: false, support: 'none' }),
        ),
      round: { start: Effect.void, end: () => Effect.void },
      track: () => Effect.void,
      exit: () => whileOpen('session.exit', Effect.void),
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

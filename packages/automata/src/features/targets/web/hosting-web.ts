import type { HostingOptions } from '../../../shared/host/hosting'
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
  RoundOutcome,
} from '../../../shared/host/index'
import type { HostRefusal, HostResult } from '../../../shared/host/plain-errors'
import { refuse } from '../../../shared/host/plain-errors'
import type { Hosting } from '../../../shared/host/plain-hosting'
import { disposables } from '../../../shared/lib/disposables'
import { ok } from '../../../shared/lib/result'
import { emitter, type Subscribable, subscribable } from '../../../shared/lib/subscribable'
import { guardRounds } from '../rounds'

/*
 * The web adapter (PUB spec §3.1): `Hosting` for a page outside Ruken, chosen at build time for the `itch` and
 * `web` targets through `@mcthaydt/automata-host/target` (ADR 0005). It mirrors the SDK's standalone session
 * wherever the SDK defines one and adds what a page can observe. It never falls back to memory for saves: when
 * the browser blocks storage, `saves` is not granted and every call is refused `DENIED`.
 *
 * Every type comes from AF's host contract (DIST spec §4), so a bundle built with this adapter holds no Ruken SDK
 * code (`target.build.test.ts` builds one and checks for `RUKEN_SDK_MARKERS`).
 */

type PageListener = (event: Event) => void

/** Something to listen on: the window, its document or its visual viewport. */
export interface WebEvents {
  addEventListener(type: string, listener: PageListener, options?: AddEventListenerOptions | boolean): void
  removeEventListener(type: string, listener: PageListener, options?: EventListenerOptions | boolean): void
}

/** The parts of `localStorage` the web adapter uses (the same shape as the Ruken SDK's `StorageLike`). */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  key(index: number): string | null
  readonly length: number
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

/** Set by an `itch` or `web` build through Vite's `define` (PUB spec §3); absent in tests and other builds. */
declare const __AUTOMATA_TARGET__: unknown

/**
 * The target this build was made for: 'itch' when the build defines `__AUTOMATA_TARGET__` as 'itch', else 'web'.
 * It only chooses `hostName`; every behavior is the same on both.
 */
export function buildTarget(): WebTarget {
  return typeof __AUTOMATA_TARGET__ !== 'undefined' && __AUTOMATA_TARGET__ === 'itch' ? 'itch' : 'web'
}

/**
 * The storage probe's key. Deliberately not the SDK's own probe key: that string marks SDK code in a bundle
 * (`RUKEN_SDK_MARKERS`), and an itch build must not contain it.
 */
export const WEB_STORAGE_PROBE_KEY = 'automata:storage-probe'

/** The same as the SDK's standalone session (`standalone.ts` at d0fa2fe): nothing reserved, scale 1. */
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
function storageRefusal(operation: string, cause: unknown): HostRefusal {
  const name = cause instanceof DOMException ? cause.name : undefined
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') {
    return { code: 'QUOTA_EXCEEDED', retryable: false, operation, cause }
  }
  if (name === 'SecurityError') return { code: 'DENIED', retryable: false, operation, cause }
  return { code: 'INTERNAL', retryable: true, operation, cause }
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
 * Builds the web adapter over `page`. `dispose()` marks Hosting closed (later calls are refused `CANCELLED`), stops
 * every subscription and removes the page listeners.
 */
export function createWebHosting(options: HostingOptions, page: WebPage, target: WebTarget): Hosting {
  const owner = disposables()
  let open = true
  owner.add(() => {
    open = false
  })

  /** Runs `use` while Hosting is open; afterwards refuses, so nothing is silently dropped. */
  const whileOpen = <A>(operation: string, use: () => HostResult<A>): HostResult<A> =>
    open ? use() : refuse('CANCELLED', false, operation)

  const constant = <A>(value: A): Subscribable<A> =>
    subscribable(
      () => value,
      () => () => undefined,
      owner,
    )
  /** A value read from the page, reported again when one of `sources` fires and the value has changed. */
  const derived = <A>(
    read: () => A,
    sources: readonly (readonly [WebEvents | null | undefined, readonly string[]])[],
  ): Subscribable<A> =>
    subscribable(
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
        const stops = sources.flatMap(([source, types]) => (source ? [listen(source, types, check)] : []))
        return () => {
          for (const stop of stops) stop()
        }
      },
      owner,
    )
  const input = trackInput(page)
  owner.add(() => input.stop())

  const storage = probeStorage(page)
  // The SDK's standalone prefix, so a game's saves are the same keys whichever adapter wrote them.
  const prefix = `ruken:${options.gameId}:`
  const granted = new Set<Capability>(['lifecycle', 'input', 'display', 'audio'])
  if (storage !== null) granted.add('saves')
  const withStorage = async <A>(
    operation: string,
    use: (storage: StorageLike) => A,
  ): Promise<HostResult<A>> =>
    whileOpen(operation, () => {
      if (storage === null) return refuse('DENIED', false, operation)
      try {
        return ok(use(storage))
      } catch (cause) {
        return { ok: false, reason: storageRefusal(operation, cause) }
      }
    })

  // `guardRounds` only forwards the starts and ends it lets through, so listeners hear one end per round.
  const roundEnds = emitter<RoundOutcome | undefined>(owner)
  const rounds = guardRounds({ start: () => undefined, end: (outcome) => roundEnds.emit(outcome) })
  const unsupported = async (operation: string): Promise<HostResult<never>> =>
    whileOpen(operation, () => refuse('UNSUPPORTED', false, operation))

  const fullscreenRoot = page.document.documentElement
  const fullscreenSupported =
    page.document.fullscreenEnabled === true && fullscreenRoot.requestFullscreen !== undefined

  return {
    kind: 'web',
    hostName: target === 'itch' ? 'itch.io' : 'this page',
    handshake: { fellBack: null },
    player: { id: 'standalone', displayName: '' },
    locale: page.navigator.language || 'en',
    granted,
    ready: Promise.resolve(ok(undefined)),

    lifecycle: derived(
      () => lifecycleOf(page),
      [
        [page.document, ['visibilitychange']],
        [page, ['focus', 'blur']],
      ],
    ),
    input: subscribable(input.current, input.on, owner),
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
    savesStatus: constant<'saved'>('saved'),

    saves: {
      get: (key) => withStorage('saves.get', (local) => local.getItem(prefix + key)),
      set: (key, value) => withStorage('saves.set', (local) => local.setItem(prefix + key, value)),
      remove: (key) => withStorage('saves.remove', (local) => local.removeItem(prefix + key)),
      // Writes reach localStorage synchronously, so there is nothing left to hand over: the saves are on this
      // device (DIST-D3).
      flush: () => withStorage('saves.flush', () => ({ persisted: 'device' as const })),
      // Only this game's keys, without the prefix (the origin also holds other games' and the page's own),
      // in code-unit order so a slot list reads the same on every engine (M5 spec §4.1).
      keys: () =>
        withStorage('saves.keys', (local) => {
          const keys: string[] = []
          for (let index = 0; index < local.length; index++) {
            const key = local.key(index)
            if (key?.startsWith(prefix)) keys.push(key.slice(prefix.length))
          }
          return keys.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
        }),
      // One browser, one writer: nothing outside this session writes these saves, so nothing changes under it.
      changed: emitter<never>(owner).events,
    },
    // There is no board outside Ruken; calls are refused rather than keep a local one (PUB spec §3.1).
    leaderboards: {
      submit: () => unsupported('leaderboard.submit'),
      get: () => unsupported('leaderboard.get'),
    },
    // The Element Fullscreen API on the page's root; itch.io's frame allows it. A request the browser
    // refuses (no user gesture, a frame without allowfullscreen) is refused DENIED rather than pretended.
    setFullscreen: async (on) => {
      if (!open) return refuse('CANCELLED', false, 'display.fullscreen')
      try {
        if (!fullscreenSupported) return ok({ fullscreen: false, support: 'none' } satisfies FullscreenRes)
        const active = page.document.fullscreenElement !== null
        if (on && !active) await fullscreenRoot.requestFullscreen?.()
        if (!on && active) await page.document.exitFullscreen?.()
        return ok({
          fullscreen: page.document.fullscreenElement !== null,
          support: 'element',
        } satisfies FullscreenRes)
      } catch (cause) {
        return refuse('DENIED', false, 'display.fullscreen', cause)
      }
    },
    // No host counts rounds, but the game's round-end autosave reads the ends (M5.2), so they are kept honest.
    round: {
      start: () => rounds.start(),
      end: (outcome) => rounds.end(outcome),
      ended: roundEnds.events,
    },
    // Nothing outside Ruken collects analytics. An undisclosed event is still reported, as the Ruken adapter
    // reports it, so a game finds the mistake on any target.
    track: (event) => {
      if (options.disclosedEvents !== undefined && !options.disclosedEvents.includes(event)) {
        console.warn(`track("${event}") dropped: not in the game's disclosed analytics events`)
      }
    },
    // There is no host to go back to; the UI hides "Back to …" because `exit` is not granted (PUB spec §3.1).
    exit: async () => whileOpen('session.exit', () => refuse('UNSUPPORTED', false, 'session.exit')),
    // Nothing outside Ruken asks for the game's menu or closes the game, so these are registered and never called.
    onMenuRequest: () => () => undefined,
    onExiting: () => () => undefined,
    dispose: () => owner.dispose(),
  }
}

/**
 * The one geometry owner per document.
 *
 * It decides when to measure: at once, on every resize of the window or the visual viewport, and
 * again as the browser's bars and keyboard finish animating. Each measure is published on the root
 * (for CSS), in a Svelte 5 rune store (`geometry.current`, for components) and to `onChange`
 * listeners (for script outside Svelte: the runtime, the renderer's letterbox). Nothing else
 * writes the geometry.
 */

import { HiddenBrowserBar, isDuckDuckGo } from '../browser/hidden-browser-bar'
import { applyGeometry, type Geometry, type HostDisplay, type Insets, measureGeometry } from './geometry'

type Listen = (type: string, listener: () => void) => void

/** The parts of `window` the owner reads; a fake from `@automata/framework/testing` stands in for it in tests. */
export interface ViewportWindow {
  readonly innerWidth: number
  readonly innerHeight: number
  readonly visualViewport?:
    | {
        readonly height: number
        readonly offsetTop: number
        addEventListener: Listen
        removeEventListener: Listen
      }
    | null
    | undefined
  /** Read only where the browser needs its bar recognised (`browser/hidden-browser-bar.ts`). */
  readonly screen?: { readonly width: number; readonly height: number } | undefined
  readonly navigator?: object | undefined
  addEventListener: Listen
  removeEventListener: Listen
}

/** Injected so tests drive the settle delays with fake timers. */
export interface Timers {
  set(callback: () => void, ms: number): unknown
  clear(handle: unknown): void
}

/**
 * What `createGeometryOwner` needs: the window to read and the root to publish on, and optionally the host's
 * display, timers and a safe-area reader.
 */
export interface GeometryOwnerOptions {
  readonly window: ViewportWindow
  /** Where the geometry is published: normally `document.documentElement`. */
  readonly root: HTMLElement
  readonly host?: HostDisplay | undefined
  readonly timers?: Timers | undefined
  readonly readEnvSafeArea?: (() => Insets) | undefined
}

/** The current geometry as rune state: reading `current` in a component or `$derived` tracks it. */
export interface GeometryState {
  readonly current: Geometry
}

/**
 * The one geometry owner of a document: `geometry.current` for components, `onChange` for script,
 * `setHostDisplay`, `remeasure` and `dispose`.
 */
export interface GeometryOwner {
  readonly geometry: GeometryState
  /** Hears every measure; returns the unsubscribe. For consumers outside Svelte. */
  onChange(listener: (geometry: Geometry) => void): () => void
  /** The host's display metrics changed (Ruken `display.metrics`), or `undefined` for standalone. */
  setHostDisplay(display: HostDisplay | undefined): void
  /** For a screen that just mounted: a WebView's bars can settle with no event at all. */
  remeasure(): void
  dispose(): void
}

/**
 * When to measure again after a viewport event, in ms. A browser's bars and keyboard animate,
 * and the event can fire before the sizes stop moving: on an Android emulator the keyboard closed,
 * the last event fired mid-animation, and the inset was left at the keyboard's height with no
 * further event to correct it. Each re-measure is only a read and a style write.
 */
export const SETTLE_DELAYS_MS: readonly number[] = [100, 400, 1000]

const defaultTimers: Timers = {
  set: (callback, ms) => setTimeout(callback, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

/**
 * Reads `env(safe-area-inset-*)` through a hidden probe, since script cannot read `env()` directly.
 * An engine that does not compute `env()` (jsdom) yields 0 on every side.
 */
export function probeEnvSafeArea(root: HTMLElement): Insets {
  const doc = root.ownerDocument
  const probe = doc.createElement('div')
  probe.style.cssText =
    'position:fixed;visibility:hidden;pointer-events:none;' +
    'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)'
  const style =
    typeof doc.defaultView?.getComputedStyle === 'function'
      ? doc.defaultView.getComputedStyle(probe)
      : undefined
  const read = (value: string | undefined): number => {
    const px = Number.parseFloat(value ?? '')
    return Number.isFinite(px) && px > 0 ? px : 0
  }
  const insets = {
    top: read(style?.paddingTop),
    right: read(style?.paddingRight),
    bottom: read(style?.paddingBottom),
    left: read(style?.paddingLeft),
  }
  probe.remove()
  return insets
}

/** Whether a text field has focus, which on some browsers shrinks the whole page. */
function isEditing(doc: Document): boolean {
  const active = doc.activeElement
  return active instanceof HTMLElement && active.closest("input, textarea, [contenteditable='true']") !== null
}

/** `$state.raw`: a new Geometry object replaces the old one; nothing inside it is mutated. */
class GeometryRune implements GeometryState {
  current: Geometry

  constructor(initial: Geometry) {
    this.current = $state.raw(initial)
  }
}

/**
 * Creates the geometry owner of a document, the only writer of its geometry: make one per document. It measures
 * at once, on every resize of the window or the visual viewport, and again at 100, 400 and 1000 ms as bars and
 * the keyboard settle, and publishes each measure on the root.
 */
export function createGeometryOwner(options: GeometryOwnerOptions): GeometryOwner {
  const { window: win, root } = options
  const timers = options.timers ?? defaultTimers
  const readEnv = options.readEnvSafeArea ?? (() => probeEnvSafeArea(root))
  let host = options.host
  let settling: unknown[] = []
  let disposed = false
  // Only DuckDuckGo for Android forgets its bar; every other browser skips the check.
  const hiddenBar = win.navigator != null && isDuckDuckGo(win.navigator) ? new HiddenBrowserBar() : undefined
  let lastHeight: number | undefined
  // The layout viewport when no keyboard had shrunk it (see `GeometryInput.restingLayout`).
  let resting = { width: win.innerWidth, height: win.innerHeight }

  const readHiddenBar = (): number => {
    const screen = win.screen
    if (hiddenBar === undefined || screen == null) return 0
    const doc = root.ownerDocument
    const hidden = hiddenBar.measure({
      screenHeight: screen.height,
      innerHeight: win.innerHeight,
      portrait: screen.height > screen.width,
      editing: isEditing(doc),
      fullscreen: doc.fullscreenElement != null,
      // Unchanged since the last measure: the settle delays make this true once a size stops moving.
      settled: lastHeight === win.innerHeight,
    })
    lastHeight = win.innerHeight
    return hidden
  }

  // A page that got shorter, at the same width, while a text field has focus was shrunk by the
  // keyboard: it keeps the class it had at rest. Anything else (a rotation, a window drag, a
  // shorter page with nothing being typed) is a real resize and becomes the new resting size.
  const restingLayout = (layout: { width: number; height: number }) => {
    const shrunkByKeyboard =
      layout.width === resting.width && layout.height < resting.height && isEditing(root.ownerDocument)
    if (shrunkByKeyboard) return resting
    resting = layout
    return undefined
  }

  const read = (): Geometry => {
    const visual = win.visualViewport
    const layout = { width: win.innerWidth, height: win.innerHeight }
    return measureGeometry({
      layout,
      restingLayout: restingLayout(layout),
      visual: visual == null ? undefined : { height: visual.height, offsetTop: visual.offsetTop },
      envSafeArea: readEnv(),
      host,
      hiddenBarBottom: readHiddenBar(),
    })
  }

  const state = new GeometryRune(read())
  const listeners = new Set<(geometry: Geometry) => void>()
  applyGeometry(root, state.current)

  const measure = (): void => {
    if (disposed) return
    const next = read()
    applyGeometry(root, next)
    state.current = next
    for (const listener of [...listeners]) listener(next)
  }

  const clearSettling = (): void => {
    for (const handle of settling) timers.clear(handle)
    settling = []
  }

  // Measure now, then again as the settle delays pass; a newer event restarts the delays.
  const update = (): void => {
    if (disposed) return
    measure()
    clearSettling()
    settling = SETTLE_DELAYS_MS.map((ms) => timers.set(measure, ms))
  }

  // A page shrunk while a field had focus keeps its resting class (`restingLayout`). When the field
  // loses focus, measure again once the last settle delay has passed: on a phone the keyboard is
  // still closing at blur, and its own resize restarts the delays anyway; on a desktop window
  // shrunk while typing no resize ever comes, and this is what reclassifies it.
  const doc = root.ownerDocument
  let afterBlur: unknown
  const onFocusOut = (): void => {
    if (disposed) return
    timers.clear(afterBlur)
    afterBlur = timers.set(measure, SETTLE_DELAYS_MS.at(-1) ?? 0)
  }

  win.addEventListener('resize', update)
  win.visualViewport?.addEventListener('resize', update)
  win.visualViewport?.addEventListener('scroll', update)
  doc.addEventListener('focusout', onFocusOut)

  return {
    geometry: state,
    onChange(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    setHostDisplay(display) {
      host = display
      measure()
    },
    remeasure: update,
    dispose() {
      if (disposed) return
      disposed = true
      clearSettling()
      timers.clear(afterBlur)
      doc.removeEventListener('focusout', onFocusOut)
      listeners.clear()
      win.removeEventListener('resize', update)
      win.visualViewport?.removeEventListener('resize', update)
      win.visualViewport?.removeEventListener('scroll', update)
    },
  }
}

/**
 * Renderer-free stand-ins for the browser and the host (M1.6 spec §3.6), so the geometry owner
 * and the screens built on it can be tested without a real viewport, keyboard or Ruken.
 *
 * The window is structural (what `@mcthaydt/automata-ui`'s owner reads), so this package does not
 * depend on ui. The host display is Ruken's own `DisplayMetricsPayload` from the vendored SDK.
 */

import type { DisplayMetricsPayload } from '../../shared/host/display.schema.ts'

type Listener = () => void

/** A minimal event target: listeners per type, in the order added. */
class Events {
  private readonly listeners = new Map<string, Set<Listener>>()

  add(type: string, listener: Listener): void {
    let set = this.listeners.get(type)
    if (set === undefined) {
      set = new Set()
      this.listeners.set(type, set)
    }
    set.add(listener)
  }

  remove(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener)
  }

  fire(type: string): void {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener()
  }

  count(): number {
    let total = 0
    for (const set of this.listeners.values()) total += set.size
    return total
  }
}

/**
 * The visual viewport of `FakeViewportWindow`: its height (less the keyboard, if open), an offset, and
 * listeners for `resize`.
 */
export interface FakeVisualViewport {
  readonly height: number
  readonly offsetTop: number
  addEventListener(type: string, listener: Listener): void
  removeEventListener(type: string, listener: Listener): void
}

/**
 * A stand-in for the browser window the geometry owner reads: its size, `screen`, `navigator`, visual
 * viewport and `resize` listeners, with methods to rotate, open the keyboard and count live listeners.
 */
export interface FakeViewportWindow {
  readonly innerWidth: number
  readonly innerHeight: number
  readonly visualViewport: FakeVisualViewport
  /** `screen`, which does not move when the page does. */
  readonly screen: { readonly width: number; readonly height: number }
  /** `navigator`, for corrections that only one browser needs (DuckDuckGo's client-hint brands). */
  readonly navigator: object
  addEventListener(type: string, listener: Listener): void
  removeEventListener(type: string, listener: Listener): void
  /** Rotation, a browser bar, a window drag: both viewports take the new size. */
  resize(width: number, height: number): void
  /** The on-screen keyboard covers `height` px of the visual viewport; the layout keeps its size. */
  openKeyboard(height: number): void
  closeKeyboard(): void
  /** Live listeners on the window and its visual viewport together, to prove disposal. */
  listenerCount(): number
}

/**
 * A fake window of the given size. Its `screen` defaults to that size and its `navigator` names no browser.
 * Resizing and the keyboard fire `resize` on the window and the visual viewport, as a browser does.
 */
export function fakeViewportWindow(size: {
  width: number
  height: number
  /** Defaults to the window's starting size. */
  screen?: { width: number; height: number }
  /** Defaults to a navigator that names no browser. */
  navigator?: object
}): FakeViewportWindow {
  const windowEvents = new Events()
  const visualEvents = new Events()
  let width = size.width
  let height = size.height
  let keyboard = 0

  const visualViewport: FakeVisualViewport = {
    get height() {
      return height - keyboard
    },
    offsetTop: 0,
    addEventListener: (type, listener) => visualEvents.add(type, listener),
    removeEventListener: (type, listener) => visualEvents.remove(type, listener),
  }

  return {
    get innerWidth() {
      return width
    },
    get innerHeight() {
      return height
    },
    visualViewport,
    screen: size.screen ?? { width: size.width, height: size.height },
    navigator: size.navigator ?? {},
    addEventListener: (type, listener) => windowEvents.add(type, listener),
    removeEventListener: (type, listener) => windowEvents.remove(type, listener),
    resize(nextWidth, nextHeight) {
      width = nextWidth
      height = nextHeight
      windowEvents.fire('resize')
      visualEvents.fire('resize')
    },
    openKeyboard(keyboardHeight) {
      keyboard = keyboardHeight
      visualEvents.fire('resize')
    },
    closeKeyboard() {
      keyboard = 0
      visualEvents.fire('resize')
    },
    listenerCount: () => windowEvents.count() + visualEvents.count(),
  }
}

/**
 * Ruken's display metrics for a hosted game. Defaults are Ruken's own fixture
 * (`packages/protocol/src/fixtures/display.ts` at b30d31b): a 48 x 56 tab on the right, landscape.
 */
export function hostDisplay(
  options: {
    edge?: 'left' | 'right'
    width?: number
    scale?: DisplayMetricsPayload['scale']
    safeArea?: DisplayMetricsPayload['safeArea']
  } = {},
): DisplayMetricsPayload {
  return {
    safeArea: options.safeArea ?? { top: 0, right: 0, bottom: 0, left: 0 },
    hostReserved: {
      edge: options.edge ?? 'right',
      rect: { x: options.edge === 'left' ? 0 : 1232, y: 332, w: options.width ?? 48, h: 56 },
    },
    orientation: 'landscape',
    fullscreen: false,
    scale: options.scale ?? 1,
  }
}

/**
 * Renderer-free stand-ins for the browser and the host (M1.6 spec §3.6), so the geometry owner
 * and the screens built on it can be tested without a real viewport, keyboard or Ruken.
 *
 * The shapes are structural: they match what `@mcthaydt/automata-ui`'s owner reads from a window
 * and Ruken's `DisplayMetricsPayload`, without importing either, so this package depends on
 * neither.
 */

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

export interface FakeVisualViewport {
  readonly height: number
  readonly offsetTop: number
  addEventListener(type: string, listener: Listener): void
  removeEventListener(type: string, listener: Listener): void
}

export interface FakeViewportWindow {
  readonly innerWidth: number
  readonly innerHeight: number
  readonly visualViewport: FakeVisualViewport
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

export function fakeViewportWindow(size: { width: number; height: number }): FakeViewportWindow {
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

export interface HostDisplayFixture {
  readonly safeArea: {
    readonly top: number
    readonly right: number
    readonly bottom: number
    readonly left: number
  }
  readonly hostReserved: {
    readonly edge: 'left' | 'right'
    readonly rect: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
  }
  readonly scale: 1 | 1.333
}

/**
 * Ruken's display metrics for a hosted game. Defaults are Ruken's own fixture
 * (`packages/protocol/src/fixtures/display.ts` at b30d31b): a 48 x 56 tab on the right.
 */
export function hostDisplay(
  options: {
    edge?: 'left' | 'right'
    width?: number
    scale?: 1 | 1.333
    safeArea?: HostDisplayFixture['safeArea']
  } = {},
): HostDisplayFixture {
  return {
    safeArea: options.safeArea ?? { top: 0, right: 0, bottom: 0, left: 0 },
    hostReserved: {
      edge: options.edge ?? 'right',
      rect: { x: options.edge === 'left' ? 0 : 1232, y: 332, w: options.width ?? 48, h: 56 },
    },
    scale: options.scale ?? 1,
  }
}

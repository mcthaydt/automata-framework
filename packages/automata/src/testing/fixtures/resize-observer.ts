/**
 * jsdom has no ResizeObserver and no layout. Primitives that measure their container (ActionBar,
 * ScrollList) are tested under jsdom by installing this and reporting widths by hand.
 */
type Callback = (entries: ResizeObserverEntry[], observer: ResizeObserver) => void

/**
 * Controls the fake `ResizeObserver` `installFakeResizeObserver` put in place: report a width to every
 * observer, then restore the original.
 */
export interface FakeResizeObserver {
  /** Reports `width` to every live observer, for every element it observes. */
  resize(width: number): void
  restore(): void
}

/**
 * Replaces the global `ResizeObserver` with a fake that reports only the widths you give it, for components
 * measured under jsdom, which has no layout. Call `restore` when the test ends.
 */
export function installFakeResizeObserver(): FakeResizeObserver {
  const previous = globalThis.ResizeObserver
  const observers = new Set<{ callback: Callback; targets: Element[] }>()

  class Fake {
    private readonly entry: { callback: Callback; targets: Element[] }
    constructor(callback: Callback) {
      this.entry = { callback, targets: [] }
      observers.add(this.entry)
    }
    observe(target: Element): void {
      this.entry.targets.push(target)
    }
    unobserve(): void {}
    disconnect(): void {
      observers.delete(this.entry)
    }
  }

  globalThis.ResizeObserver = Fake as unknown as typeof ResizeObserver
  return {
    resize(width) {
      for (const { callback, targets } of [...observers]) {
        const entries = targets.map(
          (target) => ({ target, contentRect: { width } }) as unknown as ResizeObserverEntry,
        )
        callback(entries, {} as ResizeObserver)
      }
    },
    restore() {
      globalThis.ResizeObserver = previous
    },
  }
}

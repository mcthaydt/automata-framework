/**
 * jsdom has no ResizeObserver and no layout. Primitives that measure their container (ActionBar,
 * ScrollList) are tested under jsdom by installing this and reporting widths by hand.
 * From FloorFifty `tests/client/support/resize-observer.ts` at 122a220.
 */
type Callback = (entries: ResizeObserverEntry[], observer: ResizeObserver) => void

export interface FakeResizeObserver {
  /** Reports `width` to every live observer, for every element it observes. */
  resize(width: number): void
  restore(): void
}

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

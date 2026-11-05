import { describe, expect, it } from 'vitest'
import { subscribable } from '#src/shared/lib/subscribable.ts'

/** A source like the SDK's: a current value and an `on('change')`. */
function source<A>(initial: A) {
  let value = initial
  const listeners = new Set<(v: A) => void>()
  return {
    set(next: A) {
      value = next
      for (const listener of [...listeners]) listener(next)
    },
    get: () => value,
    listen(fn: (v: A) => void) {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
    listenerCount: () => listeners.size,
  }
}

describe('subscribable', () => {
  it('gives the current value first, then every change', () => {
    const s = source(1)
    const seen: number[] = []
    subscribable(s.get, s.listen).subscribe((v) => seen.push(v))
    s.set(2)
    s.set(3)
    expect(seen).toEqual([1, 2, 3])
  })

  it('get() reads the current value without subscribing', () => {
    const s = source('a')
    const sub = subscribable(s.get, s.listen)
    s.set('b')
    expect(sub.get()).toBe('b')
    expect(s.listenerCount()).toBe(0)
  })

  it('listens before it reads, so a change landing in between is not lost', () => {
    const s = source(1)
    const seen: number[] = []
    // The source changes while the subscriber is being set up: the listener must already be attached.
    const sub = subscribable(() => {
      s.set(2)
      return s.get()
    }, s.listen)
    sub.subscribe((v) => seen.push(v))
    expect(seen.at(-1)).toBe(2)
  })

  it('stops hearing changes after unsubscribe, and releases the source listener', () => {
    const s = source(1)
    const seen: number[] = []
    const stop = subscribable(s.get, s.listen).subscribe((v) => seen.push(v))
    stop()
    s.set(2)
    expect(seen).toEqual([1])
    expect(s.listenerCount()).toBe(0)
  })
})

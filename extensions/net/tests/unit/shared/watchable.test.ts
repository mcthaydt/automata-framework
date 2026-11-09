import { describe, expect, it } from 'vitest'
import { createWatchable } from '#src/shared/watchable.ts'

describe('a watchable value', () => {
  it('reads what it was made with, and what was last set', () => {
    const value = createWatchable<number>(1)
    expect(value.get()).toBe(1)
    value.set(2)
    expect(value.get()).toBe(2)
  })

  it('tells each listener of a change, once, until it unsubscribes', () => {
    const value = createWatchable<string>('a')
    const heard: string[] = []
    const off = value.subscribe((next) => heard.push(next))
    value.set('b')
    value.set('b')
    off()
    value.set('c')
    expect(heard).toEqual(['b'])
  })

  it('does not replay the current value to a new listener', () => {
    const value = createWatchable<string>('a')
    const heard: string[] = []
    value.subscribe((next) => heard.push(next))
    expect(heard).toEqual([])
  })

  it('ends every listener on the newest value when a listener sets it again', () => {
    // The first listener sets 'b' to 'c' while 'b' is still being announced, so the second must not be left on 'b'.
    const value = createWatchable<string>('a')
    const last: string[] = []
    value.subscribe((next) => {
      if (next === 'b') value.set('c')
    })
    value.subscribe((next) => last.push(next))
    value.set('b')
    expect(last.at(-1)).toBe('c')
  })

  it('lets a listener unsubscribe another during a change', () => {
    const value = createWatchable<number>(0)
    const heard: string[] = []
    const offSecond = value.subscribe(() => heard.push('second'))
    value.subscribe(() => offSecond())
    // Subscribed in this order: second, then the one that removes it. The second hears; the third (added next) hears too.
    value.subscribe(() => heard.push('third'))
    value.set(1)
    expect(heard).toEqual(['second', 'third'])
    value.set(2)
    expect(heard).toEqual(['second', 'third', 'third'])
  })

  it('offers readers a view that cannot set', () => {
    const value = createWatchable<number>(1)
    expect(Object.keys(value.view).sort()).toEqual(['get', 'subscribe'])
  })
})

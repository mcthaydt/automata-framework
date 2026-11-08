import { describe, expect, test, vi } from 'vitest'
import { createSelection } from '#src/shared/kit/selection/selection.ts'

describe('Selection', () => {
  test('starts empty', () => {
    const selection = createSelection<string>()
    expect(selection.ids).toEqual([])
    expect(selection.size).toBe(0)
    expect(selection.primary).toBeUndefined()
    expect(selection.has('a')).toBe(false)
  })

  test('set replaces the selection, keeps the order given, and makes the last id the primary', () => {
    const selection = createSelection<string>()
    selection.set(['sky', 'cityFar'])
    selection.set(['tiles', 'sky', 'tiles'])
    expect(selection.ids).toEqual(['tiles', 'sky'])
    expect(selection.primary).toBe('sky')
    expect(selection.has('cityFar')).toBe(false)
  })

  test('add selects one more and makes it the primary; an id already selected becomes the primary', () => {
    const selection = createSelection<number>()
    selection.add(1)
    selection.add(2)
    selection.add(1)
    expect(selection.ids).toEqual([2, 1])
    expect(selection.primary).toBe(1)
  })

  test('toggle adds an id that is out and removes one that is in; the primary falls back to the one before', () => {
    const selection = createSelection<number>()
    selection.set([1, 2, 3])
    selection.toggle(3)
    expect(selection.ids).toEqual([1, 2])
    expect(selection.primary).toBe(2)
    selection.toggle(4)
    expect(selection.ids).toEqual([1, 2, 4])
    expect(selection.primary).toBe(4)
    selection.toggle(1)
    expect(selection.ids).toEqual([2, 4])
  })

  test('clear empties it', () => {
    const selection = createSelection<number>()
    selection.set([1, 2])
    selection.clear()
    expect(selection.size).toBe(0)
    expect(selection.primary).toBeUndefined()
  })

  test("range replaces the selection with the ids between two, in the caller's order, either direction", () => {
    const order = ['a', 'b', 'c', 'd', 'e']
    const selection = createSelection<string>()
    selection.set(['e'])
    selection.range('b', 'd', order)
    expect(selection.ids).toEqual(['b', 'c', 'd'])
    expect(selection.primary).toBe('d')
    selection.range('d', 'b', order)
    expect(selection.ids).toEqual(['d', 'c', 'b'])
    expect(selection.primary).toBe('b')
    selection.range('c', 'c', order)
    expect(selection.ids).toEqual(['c'])
  })

  test('range with an id that is not in the order changes nothing', () => {
    const selection = createSelection<string>()
    selection.set(['a'])
    const before = selection.ids
    selection.range('a', 'zzz', ['a', 'b'])
    selection.range('zzz', 'a', ['a', 'b'])
    expect(selection.ids).toBe(before)
  })

  test('ids is the same array until the selection changes', () => {
    const selection = createSelection<string>()
    selection.set(['a', 'b'])
    const first = selection.ids
    expect(selection.ids).toBe(first)
    selection.add('c')
    expect(selection.ids).not.toBe(first)
    expect(first).toEqual(['a', 'b'])
  })

  test('subscribers hear a real change once, and nothing for a no-op', () => {
    const selection = createSelection<string>()
    const heard: string[][] = []
    selection.subscribe((s) => heard.push([...s.ids]))
    selection.set(['a', 'b'])
    selection.set(['a', 'b'])
    selection.clear()
    selection.clear()
    selection.toggle('a')
    selection.range('a', 'a', ['a'])
    expect(heard).toEqual([['a', 'b'], [], ['a']])
  })

  test('a change of primary alone is a change; subscribers stop after they unsubscribe', () => {
    const selection = createSelection<string>()
    selection.set(['a', 'b'])
    const listener = vi.fn()
    const stop = selection.subscribe(listener)
    selection.add('a')
    expect(listener).toHaveBeenCalledTimes(1)
    stop()
    selection.clear()
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

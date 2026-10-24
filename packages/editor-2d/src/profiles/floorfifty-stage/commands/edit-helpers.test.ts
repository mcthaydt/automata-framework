import { describe, expect, it } from 'vitest'
import { counterIds } from '../../../model/ids'
import { minimal } from '../testing/check-docs'
import {
  checkIndex,
  freshId,
  insertAt,
  moveItem,
  removeAt,
  withKey,
  withTheme,
  withValue,
} from './edit-helpers'

describe('freshId', () => {
  it('takes the next id of the source', () => {
    expect(freshId(counterIds(), ['b0'])).toBe('00000001')
  })

  it('refuses an id the list already has: a source that repeats is a bug', () => {
    expect(() => freshId(counterIds(), ['00000001'])).toThrow(RangeError)
    expect(() => freshId(counterIds(), ['00000001'])).toThrow('"00000001" twice')
  })
})

describe('checkIndex', () => {
  it('accepts every index of the list', () => {
    expect(() => checkIndex('layer', 0, 3)).not.toThrow()
    expect(() => checkIndex('layer', 2, 3)).not.toThrow()
  })

  it('names what is missing and how long the list is', () => {
    for (const index of [-1, 3, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => checkIndex('layer', index, 3), String(index)).toThrow(RangeError)
    }
    expect(() => checkIndex('set piece', 4, 2)).toThrow('there is no set piece 4; the list has 2')
  })
})

describe('list helpers', () => {
  it('insertAt puts an item at an index, and at the end', () => {
    expect(insertAt(['a', 'b'], 1, 'x')).toEqual(['a', 'x', 'b'])
    expect(insertAt(['a', 'b'], 2, 'x')).toEqual(['a', 'b', 'x'])
    expect(insertAt(['a', 'b'], 0, 'x')).toEqual(['x', 'a', 'b'])
  })

  it('removeAt drops one item and leaves the original alone', () => {
    const items = ['a', 'b', 'c']
    expect(removeAt(items, 1)).toEqual(['a', 'c'])
    expect(items).toEqual(['a', 'b', 'c'])
  })

  it('moveItem puts the item at `to` of the result', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c'])
    expect(moveItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c'])
  })
})

describe('withKey', () => {
  interface Thing {
    readonly name: string
    readonly note?: string | undefined
  }

  it('sets a key', () => {
    expect(withKey<Thing, 'name'>({ name: 'a' }, 'name', 'b')).toEqual({ name: 'b' })
  })

  it('returns the same object when the value is the one it has', () => {
    const thing: Thing = { name: 'a', note: 'n' }
    expect(withKey(thing, 'name', 'a')).toBe(thing)
    expect(withKey(thing, 'note', 'n')).toBe(thing)
  })

  it('drops an optional key when the value is undefined, so the key is gone and not unset', () => {
    const next = withKey<Thing, 'note'>({ name: 'a', note: 'n' }, 'note', undefined)
    expect(next).toEqual({ name: 'a' })
    expect('note' in next).toBe(false)
  })

  it('returns the same object when an absent key is unset again', () => {
    const thing: Thing = { name: 'a' }
    expect(withKey(thing, 'note', undefined)).toBe(thing)
  })

  it('does not change the object it was given', () => {
    const thing: Thing = { name: 'a', note: 'n' }
    withKey(thing, 'note', undefined)
    withKey(thing, 'name', 'z')
    expect(thing).toEqual({ name: 'a', note: 'n' })
  })

  it('treats NaN as the value it already has', () => {
    const thing = { n: Number.NaN }
    expect(withKey(thing, 'n', Number.NaN)).toBe(thing)
  })
})

describe('withValue and withTheme', () => {
  it('replace the value or the theme and keep the ids', () => {
    const document = minimal()
    const renamed = withValue(document, { ...document.value, displayName: 'Other' })
    expect(renamed.value.displayName).toBe('Other')
    expect(renamed.ids).toBe(document.ids)
    const retheme = withTheme(document, { ...document.value.theme, backdropAlias: 'world.other' })
    expect(retheme.value.theme.backdropAlias).toBe('world.other')
    expect(retheme.value.displayName).toBe(document.value.displayName)
    expect(retheme.ids).toBe(document.ids)
  })

  it('return the same document when given the same value or theme', () => {
    const document = minimal()
    expect(withValue(document, document.value)).toBe(document)
    expect(withTheme(document, document.value.theme)).toBe(document)
  })
})

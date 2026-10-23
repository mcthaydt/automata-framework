import { describe, expect, it } from 'vitest'
import { either, suggestNames } from './suggest'

// Suggesting the name someone meant (EDFF.1b).

describe('suggestNames', () => {
  const known = [
    'world.cityNear',
    'world.cityFar',
    'world.cityMid',
    'world.sky',
    'ambience.dawn',
    'world.cityNearGlow',
  ]

  it('offers the nearest by edit distance, nearest first', () => {
    expect(suggestNames('world.cityNaer', known)).toEqual(['world.cityNear', 'world.cityFar'])
    expect(suggestNames('world.cityXar', known)).toEqual(['world.cityFar', 'world.cityNear'])
  })

  it('ignores case, so a capital in the wrong place still finds the name', () => {
    expect(suggestNames('World.CityNear', known)[0]).toBe('world.cityNear')
  })

  it('offers at most the limit, ties in alphabetical order', () => {
    const tied = ['world.cityFar', 'world.cityBar', 'world.cityCar', 'world.sky']
    expect(suggestNames('world.cityXar', tied)).toEqual(['world.cityBar', 'world.cityCar', 'world.cityFar'])
    expect(suggestNames('world.cityXar', tied, 2)).toEqual(['world.cityBar', 'world.cityCar'])
  })

  it('reaches further for a longer name', () => {
    // 'ambience.dawm' is 13 characters: two edits. 'ambience.menu' is four edits away.
    expect(suggestNames('ambience.dawm', ['ambience.dawn', 'ambience.menu', 'ambience.dw'])).toEqual([
      'ambience.dawn',
      'ambience.dw',
    ])
    // 'sky.dawm' is 8 characters: one edit.
    expect(suggestNames('sky.dawm', ['sky.dawn', 'sky.dw'])).toEqual(['sky.dawn'])
  })

  it('counts a letter too many or too few at the start as one edit', () => {
    expect(suggestNames('xworld.sky', ['world.sky'])).toEqual(['world.sky'])
    expect(suggestNames('orld.sky', ['world.sky'])).toEqual(['world.sky'])
    expect(suggestNames('xxxworld.sky', ['world.sky'])).toEqual([])
  })

  it('counts only a swap of neighbours as one edit', () => {
    expect(suggestNames('world.xa', ['world.ay'])).toEqual([])
    expect(suggestNames('world.ax', ['world.ya'])).toEqual([])
    expect(suggestNames('world.ab', ['world.ba'])).toEqual(['world.ba'])
  })

  it('counts a mistake before a swap as well as the swap', () => {
    expect(suggestNames('wxrld.Naer', ['world.Near'])).toEqual([])
    expect(suggestNames('world.Naer', ['world.Near'])).toEqual(['world.Near'])
  })

  it('ranks a swap with a substitution: both are one edit', () => {
    expect(suggestNames('world.cityNaer', ['world.cityNear', 'world.cityNaex'])).toEqual([
      'world.cityNaex',
      'world.cityNear',
    ])
  })

  it('allows one edit even in a short name', () => {
    expect(suggestNames('sky.a', ['sky.b'])).toEqual(['sky.b'])
  })

  it('allows an edit for each six characters', () => {
    expect(suggestNames('abcdefghij', ['abcdefghxy'])).toEqual([])
    expect(suggestNames('abcdefghijkl', ['abcdefghijxy'])).toEqual(['abcdefghijxy'])
    expect(suggestNames('abcdefghijkl', ['abcdefghixyz'])).toEqual([])
  })

  it('offers nothing when no name is near', () => {
    expect(suggestNames('completely.unrelated.zzzzzzzz', known)).toEqual([])
    expect(suggestNames('x', known)).toEqual([])
  })

  it('does not offer the name it was given', () => {
    expect(suggestNames('world.sky', known)).not.toContain('world.sky')
  })
})

describe('either', () => {
  it('writes one name, two names and a list', () => {
    expect(either(['a'])).toBe('"a"')
    expect(either(['a', 'b'])).toBe('"a" or "b"')
    expect(either(['a', 'b', 'c'])).toBe('"a", "b" or "c"')
    expect(either([])).toBe('')
  })
})

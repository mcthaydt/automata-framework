import { describe, expect, test } from 'vitest'
import { assertStorePath, assertStorePrefix, comparePaths, storePathProblem } from './store-path'

describe('assertStorePath', () => {
  test.each(['a', 'stages/a.toml', 'a b/c.d', 'a/b/c/d.e', '.hidden', 'a/.hidden'])('accepts %j', (path) => {
    expect(() => assertStorePath(path)).not.toThrow()
  })

  test.each([
    ['empty', ''],
    ['a leading slash', '/a'],
    ['a trailing slash', 'a/'],
    ['an empty segment', 'a//b'],
    ['a dot segment', './a'],
    ['a dot-dot segment in the middle', 'a/../b'],
    ['only dot-dot', '..'],
    ['a backslash', 'a\\b'],
    ['a NUL', 'a\0b'],
  ])('refuses %s', (_name, path) => {
    expect(() => assertStorePath(path)).toThrow(RangeError)
  })

  test('says which path it refused', () => {
    expect(() => assertStorePath('a/../b')).toThrow(/a\/\.\.\/b/)
  })
})

describe('storePathProblem', () => {
  test.each(['a', 'stages/a.toml', '.hidden'])('has nothing to say about %j', (path) => {
    expect(storePathProblem(path)).toBeUndefined()
  })

  test.each([
    ['', 'empty'],
    ['a//b', 'empty segment'],
    ['a/../b', '".." segment'],
    ['./a', '"." segment'],
    ['a\\b', 'backslash'],
    ['a\0b', 'NUL'],
  ])('says why %j is no store path, without throwing', (path, why) => {
    expect(storePathProblem(path)).toBe(why)
  })

  test('is the reason assertStorePath throws with', () => {
    expect(() => assertStorePath('a//b')).toThrow('Not a store path (empty segment): "a//b"')
  })
})

describe('assertStorePrefix', () => {
  test.each(['', 'stages', 'stages/', 'stages/a', 'a/b/'])('accepts %j', (prefix) => {
    expect(() => assertStorePrefix(prefix)).not.toThrow()
  })

  test.each([
    ['a leading slash', '/stages'],
    ['an empty segment', 'a//b'],
    ['a dot-dot segment', '../a'],
    ['a dot segment', 'a/./b'],
    ['a backslash', 'a\\b'],
    ['a NUL', '\0'],
  ])('refuses %s', (_name, prefix) => {
    expect(() => assertStorePrefix(prefix)).toThrow(RangeError)
  })
})

describe('comparePaths', () => {
  test('orders by code unit, not by locale', () => {
    const paths = ['b', 'B', 'a', 'a/b', 'a.b', 'é']
    expect([...paths].sort(comparePaths)).toEqual(['B', 'a', 'a.b', 'a/b', 'b', 'é'])
  })
})

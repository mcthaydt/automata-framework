import { expect, test } from 'vitest'

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'clear' | 'length'>

/** P01 §10.3: one behavioral suite, run against real localStorage and against saves.storage. */
export function storageSuite(name: string, make: () => Promise<StorageLike> | StorageLike): void {
  test(`${name}: get/set/overwrite/remove`, async () => {
    const s = await make()
    expect(s.getItem('k1')).toBeNull()
    s.setItem('k1', 'a')
    s.setItem('k1', 'b')
    expect(s.getItem('k1')).toBe('b')
    s.removeItem('k1')
    expect(s.getItem('k1')).toBeNull()
    s.removeItem('missing') // no throw
  })
  test(`${name}: length, key(i) and clear`, async () => {
    const s = await make()
    s.setItem('a', '1')
    s.setItem('b', '2')
    expect(s.length).toBe(2)
    const keys = [s.key(0), s.key(1)].sort()
    expect(keys).toEqual(['a', 'b'])
    expect(s.key(2)).toBeNull()
    s.clear()
    expect(s.length).toBe(0)
  })
  test(`${name}: values are strings`, async () => {
    const s = await make()
    s.setItem('n', 42 as unknown as string)
    expect(s.getItem('n')).toBe('42')
  })
}

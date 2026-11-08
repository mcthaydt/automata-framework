import { describe, expect, test } from 'vitest'
import { counterIds, DEF_ID, ITEM_ID, randomIds } from '#src/shared/level-2d/model/ids.ts'

describe('counterIds', () => {
  test('gives 8-character base36 ids in order, zero padded', () => {
    const ids = counterIds()
    expect(ids.next()).toBe('00000001')
    expect(ids.next()).toBe('00000002')
  })

  test('is base36, so a counter past 9 is a letter', () => {
    const ids = counterIds(35)
    expect(ids.next()).toBe('0000000z')
    expect(ids.next()).toBe('00000010')
  })

  test('every id is unique and matches the id shape', () => {
    const ids = counterIds()
    const seen = new Set<string>()
    for (let i = 0; i < 2000; i++) {
      const id = ids.next()
      expect(id).toMatch(/^[0-9a-z]{8}$/)
      seen.add(id)
    }
    expect(seen.size).toBe(2000)
  })

  test('two sources with the same start give the same ids', () => {
    expect(counterIds(7).next()).toBe(counterIds(7).next())
  })
})

describe('randomIds', () => {
  test('maps the host’s random bytes to 8 base36 characters and draws fresh bytes for each id', () => {
    let call = 0
    const ids = randomIds((bytes) => {
      call++
      bytes.forEach((_, index) => {
        bytes[index] = call * 10 + index
      })
    })
    expect(ids.next()).toBe('abcdefgh')
    expect(ids.next()).toBe('klmnopqr')
    expect(call).toBe(2)
  })

  test('every byte value lands on a base36 character', () => {
    const ids = randomIds((bytes) => bytes.fill(255))
    expect(ids.next()).toMatch(/^[0-9a-z]{8}$/)
  })
})

describe('id shapes', () => {
  test('a definition id is kebab-case and starts with a letter', () => {
    for (const id of ['player-start', 'moss-steps', 'a', 'tiles2']) expect(DEF_ID.test(id)).toBe(true)
    for (const id of ['', 'Door', '1door', '-door', 'door_2', 'door ']) expect(DEF_ID.test(id)).toBe(false)
  })

  test('an item id is lower case and digits with hyphens, so a generated id and a hand-written one both fit', () => {
    const ids = counterIds()
    for (const id of [ids.next(), '9z', 'solid-top', 'a']) expect(ITEM_ID.test(id)).toBe(true)
    for (const id of ['', 'Item', '-item', 'it em', 'it_em']) expect(ITEM_ID.test(id)).toBe(false)
  })
})

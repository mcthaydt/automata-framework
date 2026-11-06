import { describe, expect, test } from 'vitest'
import { describeProjectStore } from '../../../testing/kit/store-contract'
import { createMemoryStore } from './memory-store'

describeProjectStore('memory', () => createMemoryStore())

describe('memory store', () => {
  test('is a memory store', () => {
    expect(createMemoryStore().kind).toBe('memory')
  })

  test('mtime comes from the injected clock for a new file', async () => {
    const store = createMemoryStore({ now: () => 5000 })
    expect(await store.write('a.txt', 'x')).toEqual({ ok: true, mtime: 5000 })
  })

  test('two writes in one millisecond still get increasing mtimes, so a conflict is never missed', async () => {
    const store = createMemoryStore({ now: () => 5000 })
    const first = await store.write('a.txt', 'one')
    const second = await store.write('a.txt', 'two')
    expect(first).toEqual({ ok: true, mtime: 5000 })
    expect(second).toEqual({ ok: true, mtime: 5001 })
    expect(await store.write('a.txt', 'three', { mtime: 5000 })).toMatchObject({
      ok: false,
      reason: 'conflict',
    })
  })

  test('a clock that goes backwards does not move an mtime back', async () => {
    let time = 9000
    const store = createMemoryStore({ now: () => time })
    await store.write('a.txt', 'one')
    time = 100
    expect(await store.write('a.txt', 'two')).toEqual({ ok: true, mtime: 9001 })
  })

  test('stores are independent of each other', async () => {
    const one = createMemoryStore()
    const two = createMemoryStore()
    await one.write('a.txt', 'x')
    expect(await two.list()).toEqual([])
  })

  test('has no watch', () => {
    expect(createMemoryStore().watch).toBeUndefined()
  })
})

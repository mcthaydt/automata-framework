import { expect, test } from 'vitest'
import { createFakeFrame, createMockHost } from './mock-host'
import { type Capability, RukenError } from './protocol'
import { initRuken } from './sdk-stub'
import { storageSuite } from './storage-suite'

const PROD = { gameOrigin: 'https://g-x.rukengames.com', hostOrigin: 'https://ruken.com' }

async function hostedRuken(offered: Capability[] = ['saves']) {
  const frame = createFakeFrame(PROD)
  const host = createMockHost({ frame, offered, saves: {} })
  const ruken = await initRuken(
    { gameId: 'g', wants: ['saves'], pauseBehavior: 'pause', onMenuRequest: () => true },
    frame.gameEnv,
  )
  return { ruken, host }
}

storageSuite('saves.storage (hosted)', async () => (await hostedRuken()).ruken.saves.storage)
storageSuite('saves.storage (standalone)', async () => {
  const frame = createFakeFrame({ gameOrigin: 'http://localhost:5173', hostOrigin: null })
  const ruken = await initRuken(
    { gameId: 'g', wants: [], pauseBehavior: 'pause', onMenuRequest: () => true },
    frame.gameEnv,
  )
  return ruken.saves.storage
})

test('setItem is synchronous and emits saves.set with unique writeIds; flush resolves', async () => {
  const { ruken, host } = await hostedRuken()
  ruken.saves.storage.setItem('slot.1', 'data')
  ruken.saves.storage.setItem('slot.1', 'data2')
  expect(ruken.saves.storage.getItem('slot.1')).toBe('data2') // synchronous cache
  expect(await ruken.saves.flush()).toEqual({ persisted: 'host-outbox' })
  const sets = host.received('saves.set') as Array<{ key: string; value: string; writeId: string }>
  expect(sets.map((s) => s.value)).toEqual(['data', 'data2'])
  expect(new Set(sets.map((s) => s.writeId)).size).toBe(2)
})

test('limits throw QuotaExceededError: bad key, > 1 MB value, > 256 keys, > 10 MB total', async () => {
  const { ruken } = await hostedRuken()
  const s = ruken.saves.storage
  const quota = (fn: () => void) => {
    try {
      fn()
    } catch (e) {
      return (e as RukenError).name === 'QuotaExceededError'
    }
    return false
  }
  expect(quota(() => s.setItem('bad key!', 'x'))).toBe(true)
  expect(quota(() => s.setItem('big', 'x'.repeat(1_048_577)))).toBe(true)
  const oneMB = 'x'.repeat(1_048_576) // exactly the per-key limit, which is allowed
  for (let i = 0; i < 9; i++) s.setItem(`chunk${i}`, oneMB)
  expect(quota(() => s.setItem('chunk9', oneMB))).toBe(true) // 10 x (1 MB + key bytes) > 10 MB
  s.clear()
  for (let i = 0; i < 256; i++) s.setItem(`k${i}`, '1')
  expect(quota(() => s.setItem('k256', '1'))).toBe(true)
  s.setItem('k0', 'overwrite is fine at the cap')
})

test('saves.status and saves.changed update the game', async () => {
  const { ruken, host } = await hostedRuken()
  expect(ruken.saves.status).toBe('saved')
  const statuses: string[] = []
  ruken.saves.on('status', (st) => statuses.push(st))
  host.sendEvt('saves.status', { state: 'offline-queued' })
  host.sendEvt('saves.changed', { key: 'slot1', value: 'from-other-device', revision: 7 })
  await host.sync()
  expect(statuses).toEqual(['offline-queued'])
  expect(ruken.saves.storage.getItem('slot1')).toBe('from-other-device')
})

test('writes are DENIED when the saves capability was not granted', async () => {
  const { ruken } = await hostedRuken([])
  expect(() => ruken.saves.storage.setItem('a', '1')).toThrow(RukenError)
})

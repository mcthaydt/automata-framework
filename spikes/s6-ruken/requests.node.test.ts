import { afterEach, expect, test, vi } from 'vitest'
import { createFakeFrame, createMockHost } from './mock-host'
import { RukenError } from './protocol'
import { initRuken } from './sdk-stub'

afterEach(() => {
  vi.useRealTimers()
})

const OPTS = {
  gameId: 'g',
  wants: ['saves', 'menu', 'links'] as const,
  pauseBehavior: 'pause' as const,
  onMenuRequest: () => true,
}
const PROD = { gameOrigin: 'https://g-x.rukengames.com', hostOrigin: 'https://ruken.com' }

test('an error res rejects with RukenError carrying code and retryable', async () => {
  const frame = createFakeFrame(PROD)
  createMockHost({
    frame,
    offered: ['saves'],
    saves: {},
    respond: { 'saves.flush': { error: 'OFFLINE', retryable: true } },
  })
  const ruken = await initRuken(OPTS, frame.gameEnv)
  const err = await ruken.saves.flush().catch((e: unknown) => e)
  expect(err).toBeInstanceOf(RukenError)
  expect((err as RukenError).code).toBe('OFFLINE')
  expect((err as RukenError).retryable).toBe(true)
})

test('a request with no answer rejects with TIMEOUT after the catalog timeout (saves.flush = 5 s)', async () => {
  const frame = createFakeFrame(PROD)
  createMockHost({ frame, offered: ['saves'], saves: {}, respond: { 'saves.flush': 'silent' } })
  const ruken = await initRuken(OPTS, frame.gameEnv)
  vi.useFakeTimers()
  const p = ruken.saves.flush().catch((e: unknown) => e)
  await vi.advanceTimersByTimeAsync(4_999)
  let settled = false
  void p.then(() => {
    settled = true
  })
  await Promise.resolve()
  expect(settled).toBe(false)
  await vi.advanceTimersByTimeAsync(1)
  const err = await p
  expect((err as RukenError).code).toBe('TIMEOUT')
})

test('a late response after TIMEOUT is dropped (no crash, no double settle)', async () => {
  const frame = createFakeFrame(PROD)
  const host = createMockHost({ frame, offered: ['saves'], saves: {}, respond: { 'saves.flush': 'late' } })
  const ruken = await initRuken(OPTS, frame.gameEnv)
  vi.useFakeTimers()
  const p = ruken.saves.flush().catch((e: unknown) => e)
  await vi.advanceTimersByTimeAsync(6_000)
  expect(((await p) as RukenError).code).toBe('TIMEOUT')
  vi.useRealTimers()
  await host.sync()
  expect(host.received('saves.flush').length).toBe(1)
})

test('an unknown H->G request gets UNSUPPORTED; an unknown evt is ignored (P01 §5)', async () => {
  const frame = createFakeFrame(PROD)
  const host = createMockHost({ frame, offered: [], saves: {} })
  await initRuken(OPTS, frame.gameEnv)
  host.sendEvt('future.thing', { x: 1 })
  const res = await host.request('future.query', {})
  expect(res.error?.code).toBe('UNSUPPORTED')
})

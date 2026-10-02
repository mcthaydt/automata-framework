import { afterEach, expect, test, vi } from 'vitest'
import { createFakeFrame, createMockHost } from './mock-host'
import { makeEnvelope } from './protocol'
import { initRuken } from './sdk-stub'

afterEach(() => {
  vi.useRealTimers()
})

const OPTS = {
  gameId: 'blank-game',
  wants: ['saves', 'menu'] as const,
  pauseBehavior: 'pause' as const,
  onMenuRequest: () => true,
}
const PROD = { gameOrigin: 'https://g-x.rukengames.com', hostOrigin: 'https://ruken.com' }

test('hosted: hello -> welcome over a MessagePort; ready only after session.ready (R-04)', async () => {
  const frame = createFakeFrame(PROD)
  const host = createMockHost({ frame, offered: ['lifecycle', 'saves', 'menu'], saves: { slot1: 'abc' } })
  const ruken = await initRuken(OPTS, frame.gameEnv)
  expect(ruken.hosted).toBe(true)
  expect(ruken.granted.has('saves')).toBe(true)
  expect(ruken.saves.storage.getItem('slot1')).toBe('abc')
  let ready = false
  void ruken.ready.then(() => {
    ready = true
  })
  await host.sync()
  expect(ready).toBe(false)
  host.sendEvt('session.ready', {})
  await ruken.ready
  expect(ready).toBe(true)
})

test('welcome from a non-allowlisted origin is ignored; standalone after 10 s of hello every 250 ms', async () => {
  vi.useFakeTimers()
  const frame = createFakeFrame({ ...PROD, hostOrigin: 'https://evilruken.com' })
  createMockHost({ frame, offered: ['lifecycle'], saves: {} })
  const p = initRuken(OPTS, frame.gameEnv)
  await vi.advanceTimersByTimeAsync(10_000)
  const ruken = await p
  expect(ruken.hosted).toBe(false)
  expect(frame.helloCount()).toBeGreaterThanOrEqual(40)
})

test('forged welcome (allowlisted origin, wrong source: the game posting to itself) is ignored', async () => {
  vi.useFakeTimers()
  const frame = createFakeFrame({ gameOrigin: 'http://localhost:4400', hostOrigin: null })
  // Make it framed, but with no host answering.
  frame.gameEnv.isTopLevel = false
  frame.gameEnv.parent = frame.parentWindow
  const p = initRuken(OPTS, frame.gameEnv)
  const { port2 } = new MessageChannel()
  frame.deliverToGame({
    data: makeEnvelope('evt', 'welcome', {}),
    origin: 'http://localhost:4400',
    source: frame.selfWindow,
    ports: [port2],
  })
  await vi.advanceTimersByTimeAsync(10_000)
  expect((await p).hosted).toBe(false)
})

test('a second welcome is ignored', async () => {
  const frame = createFakeFrame(PROD)
  const host = createMockHost({ frame, offered: ['saves'], saves: { a: 'first' } })
  const ruken = await initRuken(OPTS, frame.gameEnv)
  const { port2 } = new MessageChannel()
  frame.deliverToGame({
    data: makeEnvelope('evt', 'welcome', { saves: { snapshot: { a: 'second' }, status: 'saved' } }),
    origin: 'https://ruken.com',
    source: frame.parentWindow,
    ports: [port2],
  })
  await host.sync()
  expect(ruken.saves.storage.getItem('a')).toBe('first')
})

test('standalone when top-level: saves go to localStorage under ruken:<gameId>:, ready resolves at once', async () => {
  const frame = createFakeFrame({ gameOrigin: 'http://localhost:5173', hostOrigin: null })
  const ruken = await initRuken(OPTS, frame.gameEnv)
  expect(ruken.hosted).toBe(false)
  ruken.saves.storage.setItem('slot1', 'xyz')
  expect(frame.storage.get('ruken:blank-game:slot1')).toBe('xyz')
  await ruken.ready
})

test('lifecycle.changed reaches the game; menu.open is answered via onMenuRequest', async () => {
  const frame = createFakeFrame(PROD)
  const host = createMockHost({ frame, offered: ['lifecycle', 'menu'], saves: {} })
  const onMenu = vi.fn(() => true)
  const ruken = await initRuken({ ...OPTS, onMenuRequest: onMenu }, frame.gameEnv)
  const states: string[] = []
  ruken.lifecycle.on('change', (e) => states.push(e.state))
  host.sendEvt('lifecycle.changed', { state: 'background', reasons: ['host-overlay'] })
  const res = await host.request('menu.open', {})
  expect(states).toEqual(['background'])
  expect(ruken.lifecycle.state).toBe('background')
  expect(onMenu).toHaveBeenCalledOnce()
  expect(res.payload).toEqual({ opened: true })
})

test('entitlements.changed updates entitlements (store items / subscriptions)', async () => {
  const frame = createFakeFrame(PROD)
  const host = createMockHost({ frame, offered: ['entitlements'], saves: {} })
  const ruken = await initRuken({ ...OPTS, wants: ['entitlements'] }, frame.gameEnv)
  const seen: string[][] = []
  ruken.onEntitlements((e) => seen.push(e.items))
  host.sendEvt('entitlements.changed', {
    ads: false,
    items: ['stage-pack-1'],
    subscriptions: [],
    devBuild: true,
  })
  await host.sync()
  expect(ruken.entitlements.items).toEqual(['stage-pack-1'])
  expect(seen).toEqual([['stage-pack-1']])
})

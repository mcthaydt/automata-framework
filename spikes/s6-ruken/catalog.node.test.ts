import { expect, test } from 'vitest'
import { createFakeFrame, createMockHost } from './mock-host'
import { CATALOG, type Capability, catalogRow } from './protocol'
import { initRuken } from './sdk-stub'

const PROD = { gameOrigin: 'https://g-x.rukengames.com', hostOrigin: 'https://ruken.com' }
const ALL: Capability[] = [
  'lifecycle',
  'input',
  'display',
  'audio',
  'exit',
  'menu',
  'saves',
  'leaderboards',
  'entitlements',
  'store',
  'ads',
  'telemetry',
  'analytics.custom',
  'links',
]

async function session() {
  const frame = createFakeFrame(PROD)
  const host = createMockHost({ frame, offered: ALL, saves: {} })
  const ruken = await initRuken(
    { gameId: 'g', wants: ALL, pauseBehavior: 'pause', onMenuRequest: () => true },
    frame.gameEnv,
  )
  return { ruken, host }
}

// Generated from the P01 §7 catalog: every host->game event is accepted without the game answering it.
test.each(CATALOG.filter((r) => r.dir === 'H→G' && r.kind === 'evt' && r.type !== 'welcome'))(
  'H->G evt $type is consumed without a response',
  async (row) => {
    const { host } = await session()
    host.sendEvt(row.type, {})
    await host.sync()
    expect(host.inbox.filter((m) => m.kind === 'res' && m.type === row.type)).toEqual([])
  },
)

// Every host->game request gets exactly one res with the matching `re`.
test.each(CATALOG.filter((r) => r.dir === 'H→G' && r.kind === 'req'))(
  'H->G req $type gets one matching res',
  async (row) => {
    const { host } = await session()
    const res = await host.request(row.type, {})
    expect(res.kind).toBe('res')
    expect(host.inbox.filter((m) => m.re === res.re).length).toBe(1)
  },
)

// Everything the game sends in a scripted session has the kind and direction the catalog says.
test('every game->host message in a session matches its catalog kind and direction', async () => {
  const { ruken, host } = await session()
  ruken.saves.storage.setItem('a', '1')
  ruken.saves.storage.removeItem('a')
  await ruken.saves.flush()
  await ruken.request('links.open', { url: 'https://example.com' })
  const sent = host.inbox.filter((m) => m.kind !== 'res')
  expect(sent.length).toBeGreaterThanOrEqual(4)
  for (const m of sent) {
    const row = catalogRow(m.type)
    expect(row, m.type).toBeDefined()
    expect(row?.dir).toBe('G→H')
    expect(row?.kind).toBe(m.kind)
  }
})

test('the game refuses to send a request that is not a G->H req in the catalog', async () => {
  const { ruken } = await session()
  await expect(ruken.request('menu.open', {})).rejects.toMatchObject({ code: 'UNSUPPORTED' })
})

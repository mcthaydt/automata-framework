import { describe, expect, it } from 'vitest'
import { itchHarnessPorts } from './ports.ts'

// Chromium refuses these ports outright (net/base/port_util.cc, the range the harness can reach).
const CHROMIUM_BLOCKED = [5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669, 6679, 6697]

describe('the itch harness ports', () => {
  it('sit 600 above the checkout server port and 1500 above its preview port', () => {
    expect(itchHarnessPorts({ AF_E2E_SERVER_PORT: '4780', AF_E2E_PREVIEW_PORT: '4880' })).toEqual({
      page: 5380,
      game: 6380,
    })
  })

  it('use the fixed pair on CI', () => {
    expect(itchHarnessPorts({ GITHUB_ACTIONS: 'true' })).toEqual({ page: 5200, game: 6200 })
  })

  it('never land on a port Chromium blocks, for any checkout slot', () => {
    for (let slot = 0; slot < 100; slot++) {
      const ports = itchHarnessPorts({
        AF_E2E_SERVER_PORT: String(4600 + slot),
        AF_E2E_PREVIEW_PORT: String(4700 + slot),
      })
      expect(CHROMIUM_BLOCKED).not.toContain(ports.page)
      expect(CHROMIUM_BLOCKED).not.toContain(ports.game)
    }
  })
})

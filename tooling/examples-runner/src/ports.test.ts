import { afterEach, describe, expect, it, vi } from 'vitest'
import { browserSafePort } from '../../../packages/ship/src/ports/browser-safe-port.ts'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('the examples ports', () => {
  it('are all ports a browser loads under CI’s fixed pair (the fixtures sat on 6000, X11)', async () => {
    vi.stubEnv('GITHUB_ACTIONS', 'true')
    vi.stubEnv('AF_E2E_DEMO_HOST_PORT', undefined)
    const ports = await import('../host/ports.ts')
    const derived = [
      ports.demoHostPort,
      ports.examplesPort,
      ports.runnerFixturesPort,
      ports.playgroundPort,
      ports.playgroundFramePort,
    ]
    for (let slot = 0; slot < 8; slot += 1) derived.push(ports.demoPort(slot))
    for (const port of derived) expect(port, `port ${port}`).toBe(browserSafePort(port))
  })

  it('keep Emberwick’s game off 5000, where macOS’s AirPlay Receiver listens (the nightly found it taken)', async () => {
    vi.stubEnv('GITHUB_ACTIONS', 'true')
    const emberwick = await import('../../../games/emberwick/e2e/origins.ts')
    expect(emberwick.gamePort).toBe(5001)
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { browserSafePort } from '../../../../packages/tools/src/shared/ship/ports/browser-safe-port.ts'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('the examples ports', () => {
  it('are all ports a browser loads under CI’s fixed pair (the fixtures sat on 6000, X11)', async () => {
    vi.stubEnv('GITHUB_ACTIONS', 'true')
    vi.stubEnv('AF_E2E_DEMO_HOST_PORT', undefined)
    const ports = await import('../../host/ports.ts')
    const derived = [
      ports.demoHostPort,
      ports.examplesPort,
      ports.examples3dPort,
      ports.runnerFixturesPort,
      ports.playgroundPort,
      ports.playgroundFramePort,
    ]
    for (let slot = 0; slot < 8; slot += 1) derived.push(ports.demoPort(slot))
    for (const port of derived) expect(port, `port ${port}`).toBe(browserSafePort(port))
  })

  it('keep Emberwick’s game off 5000, where macOS’s AirPlay Receiver listens (the nightly found it taken)', async () => {
    vi.stubEnv('GITHUB_ACTIONS', 'true')
    const emberwick = await import('../../../../games/emberwick/tests/e2e/origins.ts')
    expect(emberwick.gamePort).toBe(5001)
  })

  it('give every server in one 2D journeys run its own port (Emberwick’s dev server sat on the demo host’s 5100)', async () => {
    vi.stubEnv('GITHUB_ACTIONS', 'true')
    vi.stubEnv('AF_E2E_DEMO_HOST_PORT', undefined)
    vi.stubEnv('AF_E2E_DEMO_PORT', undefined)
    const ports = await import('../../host/ports.ts')
    const emberwick = await import('../../../../games/emberwick/tests/e2e/origins.ts')
    const ui = await import('../../../../examples/2d/ui/primitives/tests/e2e/origin.ts')
    // `pnpm test:e2e --filter @af-games/emberwick --filter @af-examples/examples-2d` starts these side by side.
    const named: Record<string, number> = {
      'Emberwick game': emberwick.gamePort,
      'Emberwick host': emberwick.hostPort,
      'Emberwick dev': emberwick.devPort,
      'ui demo': ui.demoPort,
      'demo host': ports.demoHostPort,
      examples: ports.examplesPort,
      'runner fixtures': ports.runnerFixturesPort,
    }
    // Slots 6 and 7 are the examples index and the runner's fixtures, named above.
    for (let slot = 0; slot < 6; slot += 1) named[`demo slot ${slot}`] = ports.demoPort(slot)
    const owners = new Map<number, string>()
    for (const [name, port] of Object.entries(named)) {
      expect(owners.get(port), `${name} and ${owners.get(port)} share ${port}`).toBeUndefined()
      owners.set(port, name)
    }
  })
})

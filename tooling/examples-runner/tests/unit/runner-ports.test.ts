import { afterEach, describe, expect, it, vi } from 'vitest'
import { browserSafePort } from '../../../../packages/tools/src/shared/ship/ports/browser-safe-port.ts'

// A runner copy's journeys listen on a window of 2000 ports above 4600 + its AF_RUNNER_PORT_OFFSET (the PC's copies
// sit at 0, 2000 and 4000, the Mac's at 6000 and 8000, the Windows runner's at 10000). Two copies on one machine
// stay apart only while every server's port falls inside its own window, and no server's moves with the checkout's
// path or an environment variable CI does not set. This loads every module that names a test server's port, as CI
// does, and holds the whole set to that.

const OFFSETS = [0, 2000, 4000, 6000, 8000, 10000]
const WINDOW = 2000
// The frame-budget probe runs alone (its Playwright config selects nothing else), so it may sit where a journey does.
const RUNS_ALONE = new Set(['frame budget'])

/** The ports every module names, as `[name, port]`, with CI's environment and `offset` as the runner's. */
async function portsAt(offset: number): Promise<Array<[string, number]>> {
  vi.resetModules()
  vi.stubEnv('GITHUB_ACTIONS', 'true')
  vi.stubEnv('AF_RUNNER_PORT_OFFSET', String(offset))
  for (const name of [
    'AF_E2E_SERVER_PORT',
    'AF_E2E_PREVIEW_PORT',
    'AF_E2E_DEMO_PORT',
    'AF_E2E_DEMO_HOST_PORT',
    'AF_FRAME_BUDGET_PORT',
    'AF_E2E_PLAYGROUND_PORT',
    'AF_E2E_PLAYGROUND_FRAME_PORT',
  ])
    vi.stubEnv(name, undefined)
  const host = await import('../../../examples-runner/host/ports.ts')
  const emberwick = await import('../../../../games/emberwick/tests/e2e/origins.ts')
  const base3d = await import('../../../../games/base-3d/e2e/origin.ts')
  const ui = await import('../../../../examples/2d/ui/primitives/tests/e2e/origin.ts')
  const hotReload = await import('../../../../examples/2d/content/hot-reload/tests/e2e/origin.ts')
  const frameBudget = await import('../../../frame-budget/src/origin.ts')
  const ports: Array<[string, number]> = [
    ['demo host', host.demoHostPort],
    ['examples', host.examplesPort],
    ['runner fixtures', host.runnerFixturesPort],
    ['playground', host.playgroundPort],
    ['playground frame', host.playgroundFramePort],
    ['base-3d dev', host.base3dDevPort],
    ['emberwick game', emberwick.gamePort],
    ['emberwick host', emberwick.hostPort],
    ['base-3d game', base3d.gamePort],
    ['ui primitives', ui.demoPort],
    ['hot reload', hotReload.port],
    ['hot reload dev', hotReload.devPort],
    ['frame budget', frameBudget.stressPort],
  ]
  // The examples runner's demos each take a slot; the six feature demos and the ones after them.
  for (let slot = 0; slot < 12; slot += 1) ports.push([`demo slot ${slot}`, host.demoPort(slot)])
  return ports
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe.each(OFFSETS)('the journeys’ ports under runner offset %i', (offset) => {
  it('sit in the runner’s own window, a port each, and ones a browser loads', async () => {
    const ports = await portsAt(offset)
    const low = 4600 + offset
    const owners = new Map<number, string>()
    for (const [name, port] of ports) {
      expect(port, `${name} ${port} is outside ${low}–${low + WINDOW - 1}`).toBeGreaterThanOrEqual(low)
      expect(port, `${name} ${port} is outside ${low}–${low + WINDOW - 1}`).toBeLessThan(low + WINDOW)
      expect(port, `${name} ${port} is a port a browser or the Mac refuses`).toBe(browserSafePort(port))
      const other = owners.get(port)
      // The examples runner's slots 0–5 are the feature demos, which the ones named above reuse on purpose.
      const shared = [name, other].some(
        (owner) => owner?.startsWith('demo slot') || RUNS_ALONE.has(owner ?? ''),
      )
      if (other !== undefined && !shared) expect.fail(`${name} and ${other} share port ${port}`)
      owners.set(port, name)
    }
  })
})

describe('two runner copies', () => {
  it('never name the same port', async () => {
    // One at a time: each load stubs the environment the modules read.
    const seen = new Map<number, number>()
    for (const offset of OFFSETS) {
      const ports = await portsAt(offset)
      for (const [name, port] of ports) {
        const earlier = seen.get(port)
        expect(earlier, `${name} at offset ${offset} meets offset ${earlier} on ${port}`).toBeUndefined()
      }
      for (const [, port] of ports) seen.set(port, offset)
    }
  })
})

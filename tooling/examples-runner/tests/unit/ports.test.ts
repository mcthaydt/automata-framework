import { createServer, type Server } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CLAIMED_PORTS_ENV,
  isBrowserSafePort,
} from '../../../../packages/tools/src/shared/ship/ports/free-ports.ts'

// Jobs on one machine (two jobs of one runner copy, or two copies) used to derive the same journey ports from the checkout
// and the runner's offset, and the second job's webServer died with "http://127.0.0.1:5100/ is already used". Every module
// that names a test server's port now claims it from the operating system (packages/tools free-ports.ts). This loads every
// one of them, as a Playwright config and its tests do, and holds the whole set to being free, distinct and shared.

const held: Server[] = []

afterEach(async () => {
  vi.unstubAllEnvs()
  vi.resetModules()
  await Promise.all(held.splice(0).map((server) => new Promise((done) => server.close(done))))
})

/** Holds `port` the way a running server does; rejects when something else already does. */
function occupy(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => {
      held.push(server)
      resolve()
    })
  })
}

/** The ports every module names, as `[name, port]`, in a run whose environment starts empty. */
async function portsOfARun(): Promise<Array<[string, number]>> {
  vi.resetModules()
  // Stubbed first, so the claims the modules write into the environment are removed again after the test.
  vi.stubEnv(CLAIMED_PORTS_ENV, '')
  const host = await import('../../host/ports.ts')
  const emberwick = await import('../../../../games/emberwick/tests/e2e/origins.ts')
  const base3d = await import('../../../../games/base-3d/e2e/origin.ts')
  const ui = await import('../../../../examples/2d/ui/primitives/tests/e2e/origin.ts')
  const hotReload = await import('../../../../examples/2d/content/hot-reload/tests/e2e/origin.ts')
  const story2d = await import('../../../../examples/2d-story/tests/e2e/origins.ts')
  const story3d = await import('../../../../examples/3d-story/tests/e2e/origins.ts')
  const frameBudget = await import('../../../frame-budget/src/origin.ts')
  const ports: Array<[string, number]> = [
    ['demo host', host.demoHostPort],
    ['examples', host.examplesPort],
    ['examples 3d', host.examples3dPort],
    ['runner fixtures', host.runnerFixturesPort],
    ['playground', host.playgroundPort],
    ['playground frame', host.playgroundFramePort],
    ['base-3d dev', host.base3dDevPort],
    ['emberwick game', emberwick.gamePort],
    ['emberwick host', emberwick.hostPort],
    ['emberwick dev', emberwick.devPort],
    ['base-3d game', base3d.gamePort],
    ['ui primitives', ui.demoPort],
    ['hot reload', hotReload.port],
    ['hot reload dev', hotReload.devPort],
    ['2d story game', story2d.gamePort],
    ['2d story editor', story2d.editorPort],
    ['3d story game', story3d.gamePort],
    ['3d story editor', story3d.editorPort],
    ['frame budget', frameBudget.stressPort],
  ]
  // The demo slots (the six feature demos, then the servers the names above take) each have their own port.
  for (let slot = 0; slot < 13; slot += 1) ports.push([`demo slot ${slot}`, host.demoPort(slot)])
  return ports
}

/** The ports the modules above name that are not a demo slot (a slot is another name for one of them, or for none). */
const named = (ports: Array<[string, number]>): Array<[string, number]> =>
  ports.filter(([name]) => !name.startsWith('demo slot'))

describe('the journeys’ ports', () => {
  it('are each a port of their own, and ones a browser loads', async () => {
    const owners = new Map<number, string>()
    for (const [name, port] of await portsOfARun()) {
      expect(isBrowserSafePort(port), `${name} ${port} is a port a browser or the Mac refuses`).toBe(true)
      const other = owners.get(port)
      // The slots are the names the demos and servers take, so one slot is also one of the modules' ports on purpose.
      const sharesASlot = name.startsWith('demo slot') || other?.startsWith('demo slot') === true
      if (other !== undefined && !sharesASlot) expect.fail(`${name} and ${other} share port ${port}`)
      owners.set(port, name)
    }
  })

  it('give every server of one run a port of its own, a slot’s included', async () => {
    const ports = await portsOfARun()
    const slots = ports.filter(([name]) => name.startsWith('demo slot')).map(([, port]) => port)
    expect(new Set(slots).size, 'two demo slots share a port').toBe(slots.length)
    // The examples index, the fixtures, the playground, base-3d and the 3d examples are the slots after the feature demos.
    const byName = new Map(ports)
    const bySlot = (slot: number) => byName.get(`demo slot ${slot}`)
    expect(byName.get('examples')).toBe(bySlot(6))
    expect(byName.get('runner fixtures')).toBe(bySlot(7))
    expect(byName.get('base-3d game')).toBe(bySlot(10))
  })

  it('are free to listen on, and the same ones every time the run’s environment is read (a worker reads it)', async () => {
    const first = await portsOfARun()
    const claimed = process.env[CLAIMED_PORTS_ENV]
    await Promise.all(named(first).map(([, port]) => occupy(port).catch(() => undefined)))
    vi.resetModules()
    // The same environment, as a Playwright worker has it: the modules load again and name the same ports.
    const host = await import('../../host/ports.ts')
    expect(process.env[CLAIMED_PORTS_ENV]).toBe(claimed)
    expect(host.demoHostPort).toBe(first.find(([name]) => name === 'demo host')?.[1])
  })
})

describe('two runs on one machine', () => {
  it('never name the same port, so the second one’s servers start while the first one’s are still up', async () => {
    const first = named(await portsOfARun())
    // The first run's servers are listening.
    for (const [name, port] of first)
      await occupy(port).catch(() => expect.fail(`${name} ${port} was not free`))
    for (let copy = 0; copy < 3; copy += 1) {
      const second = named(await portsOfARun())
      for (const [name, port] of second) {
        await expect(occupy(port), `${name} ${port} is held by the first run`).resolves.toBeUndefined()
      }
    }
  })
})

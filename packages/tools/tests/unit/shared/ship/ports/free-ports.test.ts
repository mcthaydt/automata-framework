import { createServer, type Server } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import {
  CLAIMED_PORTS_ENV,
  claimPort,
  claimPorts,
  isBrowserSafePort,
} from '#src/shared/ship/ports/free-ports.ts'

// Jobs on one machine used to meet on ports derived from the checkout (4700 + a runner offset): the second job's
// Playwright webServer died with "http://127.0.0.1:5100/ is already used". A port is now asked of the OS when the
// config loads, and written into the environment so the workers and the servers the config starts use the same ones.

const held: Server[] = []

/** Holds `port` the way a running test server does, until the test ends. */
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

afterEach(async () => {
  await Promise.all(held.splice(0).map((server) => new Promise((done) => server.close(done))))
})

describe('claimPorts', () => {
  it('gives each name its own port, so a game and its editor never share one', () => {
    const env: Record<string, string | undefined> = {}
    const { game, editor } = claimPorts(['game', 'editor'], env)
    expect(game).not.toBe(editor)
    for (const port of [game, editor]) {
      expect(Number.isInteger(port)).toBe(true)
      expect(port).toBeGreaterThan(1023)
      expect(port).toBeLessThan(65536)
    }
  })

  it('gives ports that are free to listen on', async () => {
    const { a, b, c } = claimPorts(['a', 'b', 'c'], {})
    await expect(Promise.all([occupy(a), occupy(b), occupy(c)])).resolves.toBeDefined()
  })

  it('gives a port no browser refuses (a journey on 6000 fails before its page loads)', () => {
    const names = Array.from({ length: 40 }, (_, index) => `server-${index}`)
    for (const port of Object.values(claimPorts(names, {}))) expect(isBrowserSafePort(port)).toBe(true)
  })

  it('records the ports in the environment, where the workers and the servers it starts read them', () => {
    const env: Record<string, string | undefined> = {}
    const first = claimPorts(['game', 'editor'], env)
    expect(JSON.parse(env[CLAIMED_PORTS_ENV] ?? '{}')).toEqual(first)
    // A worker (a new process with the parent's environment) asks for the same names and gets the same ports.
    expect(claimPorts(['editor', 'game'], { ...env })).toEqual(first)
    expect(claimPort('game', { ...env })).toBe(first.game)
  })

  it('gives a later claim ports apart from the earlier ones, in the same environment', () => {
    const env: Record<string, string | undefined> = {}
    const first = claimPorts(
      Array.from({ length: 12 }, (_, index) => `first-${index}`),
      env,
    )
    const second = claimPorts(
      Array.from({ length: 12 }, (_, index) => `second-${index}`),
      env,
    )
    const all = [...Object.values(first), ...Object.values(second)]
    expect(new Set(all).size).toBe(all.length)
    expect(Object.keys(JSON.parse(env[CLAIMED_PORTS_ENV] ?? '{}'))).toHaveLength(24)
  })

  it('claims only the names it has not claimed yet', () => {
    const env: Record<string, string | undefined> = {}
    const { game } = claimPorts(['game'], env)
    const both = claimPorts(['game', 'editor'], env)
    expect(both.game).toBe(game)
    expect(both.editor).not.toBe(game)
  })

  it('never gives a port something else is listening on, so two copies of a run do not collide', async () => {
    // Two runs of one journey on one machine: the second starts while the first's servers hold their ports.
    const first = claimPorts(['game', 'editor', 'host'], {})
    await Promise.all(Object.values(first).map(occupy))
    for (let copy = 0; copy < 5; copy += 1) {
      const second = claimPorts(['game', 'editor', 'host'], {})
      for (const port of Object.values(second)) expect(Object.values(first)).not.toContain(port)
    }
  })

  it('refuses a claimed-ports value it cannot read, instead of starting on guessed ports', () => {
    expect(() => claimPort('game', { [CLAIMED_PORTS_ENV]: 'not json' })).toThrow(CLAIMED_PORTS_ENV)
    expect(() => claimPort('game', { [CLAIMED_PORTS_ENV]: '{"game":"x"}' })).toThrow(CLAIMED_PORTS_ENV)
  })
})

describe('isBrowserSafePort', () => {
  it('refuses the Fetch standard’s bad ports and the AirPlay Receiver’s', () => {
    for (const port of [6000, 6665, 10080, 5060, 5000, 7000]) expect(isBrowserSafePort(port)).toBe(false)
    for (const port of [4700, 5001, 40000]) expect(isBrowserSafePort(port)).toBe(true)
  })
})

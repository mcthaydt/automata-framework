import { EventEmitter } from 'node:events'
import { ROOM_CODE_ALPHABET, ROOM_NAME } from '@mcthaydt/automata-net'
import { Effect, Exit, Fiber, Scope } from 'effect'
import { afterEach, describe, expect, it } from 'vitest'
import { startTestServer, TEST_LIMITS, type TestServer, waitFor } from '../test-support/colyseus-harness'
import { TEST_NET } from '../test-support/engine-harness'
import { fixtureServer } from '../test-support/fixture-game'
import { startServer } from './start-server'

// The server process (M7 spec §4.3 startServer, FloorFifty colyseus-server.test.ts): Effect and Scope around
// Colyseus, on ephemeral ports only.

let server: TestServer | undefined
afterEach(async () => {
  await server?.close()
  server = undefined
})

const config = { port: 0, limits: TEST_LIMITS, net: TEST_NET, env: { NODE_ENV: 'test' } }

describe('startServer', () => {
  it.each([
    ['no room cap', { ...TEST_LIMITS, maxRooms: 0 }, /maxRooms/],
    ['no origin list', { ...TEST_LIMITS, allowedOrigins: undefined as never }, /allowedOrigins/],
    ['an empty origin list', { ...TEST_LIMITS, allowedOrigins: [] }, /allowedOrigins is empty/],
    [
      'an entry that is not an origin',
      { ...TEST_LIMITS, allowedOrigins: ['https://game.test/'] },
      /not an origin/,
    ],
    ["a message cap past net's", { ...TEST_LIMITS, maxMessageBytes: 16_385 }, /maxMessageBytes/],
    [
      'no Quick match bucket',
      { ...TEST_LIMITS, perIp: { ...TEST_LIMITS.perIp, quickMatch: undefined as never } },
      /quickMatch/,
    ],
  ])('refuses to start with %s, before it listens', async (_, limits, reason) => {
    const exit = await Effect.runPromiseExit(
      Effect.scoped(startServer(fixtureServer(), { ...config, limits })),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toMatch(reason)
  })

  it('drains on SIGTERM and exits 0, and leaves the signal to the drain rather than to Colyseus', async () => {
    const signals = new EventEmitter()
    const exits: number[] = []
    const before = process.listenerCount('SIGTERM')
    const scope = Effect.runSync(Scope.make())
    const fiber = Effect.runFork(
      startServer(fixtureServer(), { ...config, signals, exit: (code) => exits.push(code) }).pipe(
        Scope.extend(scope),
      ),
    )
    await waitFor(() => signals.listenerCount('SIGTERM') === 1, 'the server never listened for SIGTERM')
    expect(process.listenerCount('SIGTERM')).toBe(before)
    signals.emit('SIGTERM')
    await waitFor(() => exits.length > 0, 'the drain never exited')
    expect(exits).toEqual([0])
    await Effect.runPromise(Fiber.interrupt(fiber))
    await Effect.runPromise(Scope.close(scope, Exit.void))
    expect(signals.listenerCount('SIGTERM')).toBe(0)
  })
})

describe('the server runtime', () => {
  it('listens on the port the system chose and answers matchmaking with a six-character room code', async () => {
    server = await startTestServer()
    expect(server.runtime.port).toBeGreaterThan(0)
    const host = await server.create('Ada')
    expect(host.code).toMatch(new RegExp(`^[${ROOM_CODE_ALPHABET}]{6}$`))
    expect(server.logs).toContainEqual({ event: 'room.created', room: expect.any(String) })
  })

  it('stops answering once its scope closes', async () => {
    server = await startTestServer()
    const base = `http://127.0.0.1:${server.runtime.port}`
    expect((await fetch(`${base}/matchmake/create/${ROOM_NAME}`, { method: 'POST' })).status).toBeLessThan(
      500,
    )
    await server.close()
    server = undefined
    await expect(fetch(`${base}/`)).rejects.toThrow()
  })

  it('refuses a room past maxRooms with SERVER_BUSY, and opens none', async () => {
    server = await startTestServer({ config: { limits: { ...TEST_LIMITS, maxRooms: 1 } } })
    await server.create('Ada')
    await expect(server.colyseus.sdk.create(ROOM_NAME, server.joinOptions('Bea'))).rejects.toThrow(
      /SERVER_BUSY/,
    )
    expect(server.runtime.rooms.size).toBe(1)
    expect(server.logs).toContainEqual({ event: 'refused', code: 'busy' })
  })

  it('opens no room once it drains, and drains to empty with no rooms', async () => {
    server = await startTestServer()
    expect(await Effect.runPromise(server.runtime.drain)).toBe('empty')
    expect(server.runtime.draining).toBe(true)
  })
})

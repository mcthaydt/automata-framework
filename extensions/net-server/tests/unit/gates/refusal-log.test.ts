import { Effect } from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AutomataRoom } from '#src/features/room/engine/automata-room.ts'
import type { ServerLimits } from '#src/shared/game/server-config.ts'
import { startTestServer, TEST_LIMITS, type TestServer, waitFor } from '#src/testing/colyseus-harness.ts'
import { upgradeStatus } from '#src/testing/raw-upgrade.ts'

// What the server tells its logs about refusals. The log writer turns these events into redacted lines.

let server: TestServer | undefined
afterEach(async () => {
  await server?.close()
  server = undefined
})

const start = (over: Partial<ServerLimits> = {}) =>
  startTestServer({ config: { limits: { ...TEST_LIMITS, ...over } } })

const refusals = (test: TestServer): string[] =>
  test.logs.flatMap((event) => (event.event === 'refused' && event.code !== undefined ? [event.code] : []))

describe('what the server logs about refusals', () => {
  it('logs a rate refusal by its limit, with no address', async () => {
    server = await start({ perIp: { ...TEST_LIMITS.perIp, create: { burst: 3, perSecond: 0.05 } } })
    for (let index = 0; index < 4; index += 1) await server.matchmake('create', server.joinOptions('Ada'))
    expect(refusals(server)).toEqual(['create'])
    expect(JSON.stringify(server.logs)).not.toContain('127.0.0.1')
  })

  it('logs a room refused at the cap as busy', async () => {
    server = await start({ maxRooms: 1 })
    await server.matchmake('create', server.joinOptions('Ada'))
    await server.matchmake('create', server.joinOptions('Ada'))
    expect(refusals(server)).toEqual(['busy'])
  })

  // A refused room never finished building; tearing it down must not throw, or every refusal at capacity writes a
  // stack trace to the journal.
  it('tears down a room refused at the cap without an error', async () => {
    const errors: unknown[] = []
    const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => void errors.push(args))
    try {
      server = await start({ maxRooms: 1 })
      const test = server
      await test.matchmake('create', test.joinOptions('Ada'))
      await test.matchmake('create', test.joinOptions('Ada'))
      await waitFor(
        () => test.logs.some((event) => event.event === 'room.disposed'),
        'the refused room was never torn down',
      )
    } finally {
      spy.mockRestore()
    }
    expect(errors.map(String).join('\n')).not.toMatch(/onDispose|dispose/)
  })

  it('logs a new room refused while draining', async () => {
    server = await start()
    const staying = { beginDrain: () => undefined } as unknown as AutomataRoom
    server.runtime.rooms.register(staying)
    const drained = Effect.runPromise(server.runtime.drain)
    // runPromise hands the drain to Effect's scheduler rather than running it inline, so wait for it to begin.
    const test = server
    await waitFor(() => test.runtime.draining, 'the drain never began')
    await server.matchmake('create', server.joinOptions('Ada'))
    expect(refusals(server)).toContain('draining')
    server.runtime.rooms.forget(staying)
    expect(await drained).toBe('empty')
  })

  // These are the gates' own refusals, each by its code; room telemetry is tested with the log writer.
  it('logs an origin, a size, a version and a socket refusal, each by its code', async () => {
    server = await start({ maxMessageBytes: 1_024 })
    await server.matchmake('create', server.joinOptions('Ada'), undefined, 'https://elsewhere.test')
    await server.matchmake('create', { ...server.joinOptions('Ada'), padding: 'x'.repeat(2_000) })
    await server.matchmake('create', { ...server.joinOptions('Ada'), contentHash: 'fedcba9876543210' })
    await upgradeStatus(server.runtime.port, null)
    expect(refusals(server)).toEqual(['origin', 'size', 'version', 'origin'])
    expect(server.runtime.rooms.size).toBe(0)
  })
})

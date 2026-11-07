import { EventEmitter } from 'node:events'
import { Effect, Exit, Fiber, Scope } from 'effect'
import { describe, expect, it } from 'vitest'
import { type EnvServerBase, runServerProcess, serverConfigFromEnv } from '#src/app/server-process.ts'
import { serverLogLine } from '#src/features/operations/server-log-line.schema.ts'
import { TEST_LIMITS, waitFor } from '#src/testing/colyseus-harness.ts'
import { TEST_NET } from '#src/testing/engine-harness.ts'
import { fixtureServer } from '#src/testing/fixture-game.ts'

// The production entry: the environment's
// limits, the refusal naming what is missing, crash handlers and the redacted writer.

const { maxRooms: _maxRooms, allowedOrigins: _allowedOrigins, ...limits } = TEST_LIMITS
const BASE: EnvServerBase = { net: TEST_NET, limits }
const ENV = {
  NODE_ENV: 'production',
  MAX_ROOMS: '40',
  ALLOWED_ORIGINS: 'https://game.example.test, https://other.example.test',
}

describe('serverConfigFromEnv', () => {
  it('reads the room cap, the origin list and the port', () => {
    const result = serverConfigFromEnv({ ...ENV, PORT: '3100' }, BASE)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.config.port).toBe(3100)
    expect(result.config.limits.maxRooms).toBe(40)
    expect(result.config.limits.allowedOrigins).toEqual([
      'https://game.example.test',
      'https://other.example.test',
    ])
    expect(result.config.limits.commandsPerSeat).toEqual(TEST_LIMITS.commandsPerSeat)
    expect(result.config.env).toEqual({ ...ENV, PORT: '3100' })
  })

  it('listens on 3000 when PORT is unset, and refuses a port that is not one', () => {
    const result = serverConfigFromEnv(ENV, BASE)
    expect(result.ok && result.config.port).toBe(3000)
    expect(serverConfigFromEnv({ ...ENV, PORT: 'eighty' }, BASE)).toEqual({ ok: false, problems: ['PORT'] })
  })

  it('refuses to run without MAX_ROOMS or ALLOWED_ORIGINS, naming each', () => {
    expect(serverConfigFromEnv({ NODE_ENV: 'production' }, BASE)).toEqual({
      ok: false,
      problems: ['MAX_ROOMS', 'ALLOWED_ORIGINS'],
    })
    expect(serverConfigFromEnv({ ...ENV, MAX_ROOMS: 'lots' }, BASE)).toEqual({
      ok: false,
      problems: ['MAX_ROOMS'],
    })
    expect(serverConfigFromEnv({ ...ENV, MAX_ROOMS: '0' }, BASE)).toEqual({
      ok: false,
      problems: ['MAX_ROOMS'],
    })
    expect(serverConfigFromEnv({ ...ENV, ALLOWED_ORIGINS: ' , ' }, BASE)).toEqual({
      ok: false,
      problems: ['ALLOWED_ORIGINS'],
    })
  })

  it('serves security.txt only when both its contact and its expiry are set', () => {
    const both = serverConfigFromEnv(
      {
        ...ENV,
        SECURITY_CONTACT: 'mailto:security@example.invalid',
        SECURITY_EXPIRES: '2027-10-30T00:00:00Z',
      },
      BASE,
    )
    expect(both.ok && both.config.securityTxt).toEqual({
      contact: 'mailto:security@example.invalid',
      expires: '2027-10-30T00:00:00Z',
    })
    const one = serverConfigFromEnv({ ...ENV, SECURITY_CONTACT: 'mailto:security@example.invalid' }, BASE)
    expect(one.ok && one.config.securityTxt).toBeUndefined()
  })
})

describe('runServerProcess', () => {
  const harness = () => {
    const lines: string[] = []
    const exits: number[] = []
    const target = new EventEmitter()
    return {
      lines,
      exits,
      target,
      options: (env: Record<string, string | undefined>) => ({
        env,
        ...BASE,
        write: (line: string) => lines.push(line),
        now: () => 1_790_000_000_000,
        process: target,
        exit: (code: number) => exits.push(code),
      }),
    }
  }

  it('refuses to start, writing one start.refused line per problem, before it listens', async () => {
    const { lines, options } = harness()
    const exit = await Effect.runPromiseExit(
      Effect.scoped(runServerProcess(fixtureServer(), options({ NODE_ENV: 'production' }))),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toMatch(/MAX_ROOMS, ALLOWED_ORIGINS/)
    expect(lines.map((line) => JSON.parse(line))).toEqual([
      { ts: 1_790_000_000_000, level: 'fatal', event: 'start.refused', code: 'MAX_ROOMS' },
      { ts: 1_790_000_000_000, level: 'fatal', event: 'start.refused', code: 'ALLOWED_ORIGINS' },
    ])
  })

  it('starts with a full environment, writes schema lines, and turns a crash into one fatal line and exit 1', async () => {
    const { lines, exits, target, options } = harness()
    const scope = Effect.runSync(Scope.make())
    const fiber = Effect.runFork(
      runServerProcess(fixtureServer(), options({ ...ENV, PORT: '0' })).pipe(Scope.extend(scope)),
    )
    await waitFor(() => lines.some((line) => line.includes('server.started')), 'the server never started')
    expect(target.listenerCount('uncaughtException')).toBe(1)
    expect(target.listenerCount('unhandledRejection')).toBe(1)
    expect(target.listenerCount('SIGTERM')).toBe(1)
    target.emit('uncaughtException', new RangeError('FAKE-TOKEN-not-a-secret'))
    expect(exits).toEqual([1])
    for (const line of lines) expect(serverLogLine.safeParse(JSON.parse(line)).success).toBe(true)
    expect(lines.at(-1)).toContain('"event":"fatal","code":"RangeError"')
    expect(lines.join('')).not.toContain('FAKE-TOKEN')
    await Effect.runPromise(Fiber.interrupt(fiber))
    await Effect.runPromise(Scope.close(scope, Exit.void))
  })
})

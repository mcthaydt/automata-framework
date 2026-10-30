import { describe, expect, it } from 'vitest'
import type { RoomLogEvent, ServerConfig } from '../game/server-config'
import { createFakeVerifier } from '../session/session-verifier'
import { TEST_LIMITS } from '../test-support/colyseus-harness'
import { TEST_NET } from '../test-support/engine-harness'
import { colyseusDebugEnabled, installCrashHandlers, isProduction, testSwitchesSet } from './process-safety'

// Process safety (M7 spec §4.3; FloorFifty `tests/server/process-safety.test.ts`, generic): no test switch in
// production, and a crash is one fatal line and exit 1.

const PRODUCTION = { NODE_ENV: 'production' }
/** A production config with everything it needs, so each case changes one thing. */
const config: ServerConfig = {
  port: 0,
  limits: { ...TEST_LIMITS, allowedOrigins: ['https://game.example.test'] },
  net: TEST_NET,
}

describe('testSwitchesSet (the production guard)', () => {
  it('starts a production server that has its limits and its origins', () => {
    expect(testSwitchesSet(config, PRODUCTION)).toEqual([])
  })

  it.each([
    ['seed', { seed: 11 }],
    ['manualClock', { manualClock: true }],
    ['verifier (fake)', { verifier: createFakeVerifier() }],
  ])('refuses %s', (name, change) => {
    expect(testSwitchesSet({ ...config, ...change }, PRODUCTION)).toEqual([name])
  })

  it('names every switch that is set, not just the first', () => {
    expect(
      testSwitchesSet({ ...config, seed: 1, manualClock: true, verifier: createFakeVerifier() }, PRODUCTION),
    ).toEqual(['seed', 'manualClock', 'verifier (fake)'])
  })

  it('ignores a switch that is set off', () => {
    expect(testSwitchesSet({ ...config, seed: undefined, manualClock: false }, PRODUCTION)).toEqual([])
  })

  it('refuses an empty origin list in production, which no client could reach', () => {
    expect(testSwitchesSet({ ...config, limits: TEST_LIMITS }, PRODUCTION)).toEqual([
      'allowedOrigins (empty)',
    ])
  })

  it('is production when any environment it is given says so: a test config cannot vouch for a production box', () => {
    expect(testSwitchesSet({ ...config, seed: 11 }, { NODE_ENV: 'test' }, PRODUCTION)).toEqual(['seed'])
    expect(testSwitchesSet({ ...config, seed: 11 }, PRODUCTION, { NODE_ENV: 'test' })).toEqual(['seed'])
  })

  it.each(['Production', 'PRODUCTION', 'production ', 'production\r', ' production\n'])(
    'reads NODE_ENV %j as production',
    (value) => {
      expect(isProduction({ NODE_ENV: value })).toBe(true)
      expect(testSwitchesSet({ ...config, seed: 11 }, { NODE_ENV: value })).toEqual(['seed'])
    },
  )

  it.each([undefined, '', 'test', 'development', 'productionish'])(
    'does not read NODE_ENV %j as production',
    (value) => {
      expect(isProduction({ NODE_ENV: value })).toBe(false)
    },
  )

  it.each([
    'colyseus:*',
    'colyseus:errors',
    '*',
    'col*',
    'app, colyseus:message',
    'colyseus:* -colyseus:patch',
  ])(
    'refuses DEBUG=%j in production, which prints Colyseus’s stacks and payloads past the redaction',
    (debug) => {
      expect(colyseusDebugEnabled({ DEBUG: debug })).toBe(true)
      expect(testSwitchesSet(config, { ...PRODUCTION, DEBUG: debug })).toEqual(['DEBUG (colyseus)'])
      expect(testSwitchesSet(config, PRODUCTION, { DEBUG: debug })).toEqual(['DEBUG (colyseus)'])
    },
  )

  it.each([undefined, '', 'app:*', 'express', '-colyseus:*', '*,-colyseus:*'])('allows DEBUG=%j', (debug) => {
    expect(colyseusDebugEnabled({ DEBUG: debug })).toBe(false)
    expect(testSwitchesSet(config, { ...PRODUCTION, DEBUG: debug })).toEqual([])
  })

  it('allows anything outside production', () => {
    const everything = {
      ...config,
      limits: TEST_LIMITS,
      seed: 1,
      manualClock: true,
      verifier: createFakeVerifier(),
    }
    expect(testSwitchesSet(everything, { NODE_ENV: 'test' })).toEqual([])
    expect(testSwitchesSet(everything, {})).toEqual([])
    expect(testSwitchesSet(everything, { NODE_ENV: 'test', DEBUG: 'colyseus:*' })).toEqual([])
  })
})

describe('installCrashHandlers', () => {
  const PLANTED = 'FAKE-TOKEN-not-a-secret-0001 from 203.0.113.77'
  const install = () => {
    const handlers = new Map<string, (error: unknown) => void>()
    const exits: number[] = []
    const events: RoomLogEvent[] = []
    installCrashHandlers(
      { on: (event, handler) => handlers.set(event, handler) },
      (event) => events.push(event),
      (code) => exits.push(code),
    )
    return { handlers, exits, events }
  }

  it('logs one fatal line, with the error’s class and none of its message, and exits 1 on an unhandled rejection', () => {
    const { handlers, exits, events } = install()
    handlers.get('unhandledRejection')?.(new TypeError(PLANTED))
    expect(exits).toEqual([1])
    expect(events).toEqual([{ event: 'fatal', code: 'TypeError' }])
  })

  it('does the same for an uncaught exception, and for a thrown non-error', () => {
    const { handlers, exits, events } = install()
    handlers.get('uncaughtException')?.(PLANTED)
    expect(exits).toEqual([1])
    expect(events).toEqual([{ event: 'fatal', code: 'Error' }])
    expect(JSON.stringify(events)).not.toContain('203.0.113.77')
  })

  it('names a class that is not an identifier as Error, so the line still parses', () => {
    const { handlers, events } = install()
    const odd = new Error('x')
    odd.name = 'Bad name 203.0.113.77'
    handlers.get('uncaughtException')?.(odd)
    expect(events).toEqual([{ event: 'fatal', code: 'Error' }])
  })
})

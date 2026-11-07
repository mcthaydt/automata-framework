import { Client } from '@colyseus/sdk'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NetError, refusalCode } from '#src/features/client/room/net-error.ts'
import { NET_ERROR_CODES } from '#src/shared/wire/server-message.schema.ts'

// How a refusal reaches a player. The server writes every refusal, room and gate alike, with net's code first
// (`RATE_LIMITED: too many requests`), so the code is read and the words are left for the log.

describe('refusalCode', () => {
  it.each(NET_ERROR_CODES)('reads %s from a refusal that leads with it', (code) => {
    expect(refusalCode(new Error(`${code}: whatever the server said`))).toBe(code)
  })

  it('reads the code, never the words', () => {
    // "The server is full" must not read as a full room, by construction.
    expect(refusalCode(new Error('SERVER_BUSY: the room is full'))).toBe('SERVER_BUSY')
  })

  it('reads a code that is not net’s as a refusal', () => {
    expect(refusalCode(new Error('ROOM_CLOSED: the room closed'))).toBe('REFUSED')
  })

  it("reads Colyseus's own matchmaking errors", () => {
    expect(refusalCode(new Error('room "ABC234" not found'))).toBe('ROOM_NOT_FOUND')
    expect(refusalCode(new Error('room "ABC234" is locked'))).toBe('ROOM_FULL')
  })

  it('reads a request that never reached a server as offline', () => {
    expect(refusalCode(new TypeError('fetch failed'))).toBe('OFFLINE')
    expect(
      refusalCode(Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:1'), { code: 'ECONNREFUSED' })),
    ).toBe('OFFLINE')
  })

  it.each(['Failed to fetch', 'NetworkError when attempting to fetch resource.', 'Load failed'])(
    "reads a browser's unreachable fetch (%s) as offline",
    (message) => {
      expect(refusalCode(new TypeError(message))).toBe('OFFLINE')
    },
  )

  it.each([
    'fetch failed',
    'Failed to fetch',
    'NetworkError when attempting to fetch resource.',
    'Load failed',
  ])('reads the SDK rethrowing fetch\'s "%s" (a MatchMakeError with no code) as offline', (message) => {
    // The real SDK never lets fetch's TypeError through: HTTP.ts rethrows it as a ServerError, the client as a
    // MatchMakeError with the same words and no code.
    const error = Object.assign(new Error(message), { name: 'MatchMakeError', code: undefined })
    expect(refusalCode(error)).toBe('OFFLINE')
  })

  it.each([1005, 1006])('reads a socket that closed with %i before the room answered as offline', (code) => {
    // The SDK's WebSocket failure during the join handshake: MatchMakeError('', 1006).
    expect(refusalCode(Object.assign(new Error(''), { name: 'MatchMakeError', code }))).toBe('OFFLINE')
  })

  it('never reads a bug as offline', () => {
    // A TypeError from our own code is not the network: the player is not told to check their connection.
    expect(refusalCode(new TypeError("Cannot read properties of undefined (reading 'roomId')"))).toBe(
      'REFUSED',
    )
  })

  it('reads anything else as a refusal', () => {
    expect(refusalCode(new Error('something odd'))).toBe('REFUSED')
    expect(refusalCode('a string')).toBe('REFUSED')
    expect(refusalCode(undefined)).toBe('REFUSED')
  })
})

describe('NetError', () => {
  it('is an Error carrying the code and the operation', () => {
    const error = new NetError({ code: 'ROOM_FULL', operation: 'join' })
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('NetError')
    expect(error).toMatchObject({ code: 'ROOM_FULL', operation: 'join' })
  })

  it('says which call failed and why, for a log', () => {
    expect(new NetError({ code: 'ROOM_FULL', operation: 'join' }).message).toBe('join failed: ROOM_FULL')
  })
})

describe('refusalCode on the real SDK', () => {
  afterEach(() => vi.unstubAllGlobals())

  it.each([
    'Failed to fetch',
    'NetworkError when attempting to fetch resource.',
    'Load failed',
    'fetch failed',
  ])('reads a browser fetch that fails with "%s" as offline', async (message) => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError(message)
    })
    const failure = await new Client('http://server.test')
      .reconnect('ABC234:token')
      .catch((error: unknown) => error)
    expect(refusalCode(failure)).toBe('OFFLINE')
  })

  it.each([
    [502, '<html><body>Bad Gateway</body></html>', 'text/html'],
    [503, '', 'text/plain'],
    [504, 'upstream timed out', 'text/plain'],
  ])('reads a gateway answering %i while the server restarts as offline', async (status, body, type) => {
    // A proxy in front of a restarting server answers for it; the SDK reports MatchMakeError('', status).
    vi.stubGlobal('fetch', async () => new Response(body, { status, headers: { 'content-type': type } }))
    const failure = await new Client('http://server.test')
      .reconnect('ABC234:token')
      .catch((error: unknown) => error)
    expect(refusalCode(failure)).toBe('OFFLINE')
  })

  it("still reads the server's own 503 refusal by its code", async () => {
    const body = JSON.stringify({ code: 4213, error: 'SERVER_UPDATING: the server is updating' })
    vi.stubGlobal(
      'fetch',
      async () => new Response(body, { status: 503, headers: { 'content-type': 'application/json' } }),
    )
    const failure = await new Client('http://server.test')
      .create('automata', {})
      .catch((error: unknown) => error)
    expect(refusalCode(failure)).toBe('SERVER_UPDATING')
  })
})

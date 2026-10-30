import { describe, expect, it } from 'vitest'
import { NET_ERROR_CODES } from '../wire/server-message.schema'
import { NetError, refusalCode } from './net-error'

// How a refusal reaches a player (M7 spec §4.2 `NetError`, §6). FloorFifty's `refusalCode` read the words; Plus's
// server writes every refusal, room and gate alike, with net's code first (`RATE_LIMITED: too many requests`), so
// the code is read and the words are left for the log.

describe('refusalCode', () => {
  it.each(NET_ERROR_CODES)('reads %s from a refusal that leads with it', (code) => {
    expect(refusalCode(new Error(`${code}: whatever the server said`))).toBe(code)
  })

  it('reads the code, never the words', () => {
    // FloorFifty's "the server is full must not read as a full room", by construction.
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

  it('reads anything else as a refusal', () => {
    expect(refusalCode(new Error('something odd'))).toBe('REFUSED')
    expect(refusalCode('a string')).toBe('REFUSED')
    expect(refusalCode(undefined)).toBe('REFUSED')
  })
})

describe('NetError', () => {
  it('is a tagged error carrying the code and the operation', () => {
    const error = new NetError({ code: 'ROOM_FULL', operation: 'join' })
    expect(error._tag).toBe('NetError')
    expect(error).toMatchObject({ code: 'ROOM_FULL', operation: 'join' })
  })
})

import { describe, expect, it } from 'vitest'
import {
  LOBBY_PHASES,
  NET_BYTES_CHANNEL,
  NET_CHANNEL,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  ROOM_NAME,
} from '#src/shared/wire/room.ts'

// The room contract a client reads (M7 spec §4.2, RoomInfo): net owns it, server imports it.

describe('the room contract', () => {
  it('has six-character codes a player can read and type', () => {
    expect(ROOM_CODE_LENGTH).toBe(6)
    expect(ROOM_CODE_ALPHABET).not.toMatch(/[IO01]/)
    expect(new Set(ROOM_CODE_ALPHABET).size).toBe(ROOM_CODE_ALPHABET.length)
  })

  it('names the four phases of RoomInfo', () => {
    expect(LOBBY_PHASES).toEqual(['lobby', 'countdown', 'playing', 'ended'])
  })

  it('names the room type and two distinct channels', () => {
    expect(ROOM_NAME).toBe('automata')
    expect(NET_CHANNEL).not.toBe(NET_BYTES_CHANNEL)
  })
})

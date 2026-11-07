import { describe, expect, it } from 'vitest'
import { RoomCommandError, toServerError } from '#src/features/room/rules/room-errors.ts'

// How a rule refuses and how any failure reaches a player.

describe('room errors', () => {
  it('keeps a refusal its own code and words', () => {
    const error = new RoomCommandError('ROOM_FULL', 'every seat is taken')
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('RoomCommandError')
    expect(toServerError(error)).toEqual({ code: 'ROOM_FULL', message: 'every seat is taken' })
  })

  it('turns anything else into a generic refusal, never the failure’s own text', () => {
    expect(toServerError(new Error('internal detail'))).toEqual({
      code: 'REFUSED',
      message: 'the server could not process that message',
    })
    expect(toServerError('a thrown string')).toEqual({
      code: 'REFUSED',
      message: 'the server could not process that message',
    })
  })
})

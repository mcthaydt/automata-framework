import { describe, expect, it } from 'vitest'
import { serverLogLine } from './server-log-line.schema'

// The log line (M7 spec §4.5): strict, and no field can hold an address, a name, a room code, a token or a payload.

const base = { ts: 1_790_000_000_000, level: 'info' as const }

describe('serverLogLine', () => {
  it.each([
    { event: 'room.created', room: '3' },
    { event: 'room.disposed', room: '3' },
    { event: 'seat.joined', room: '3', seat: 0 },
    { event: 'seat.left', room: '3', seat: 1, code: 'grace' },
    { event: 'refused', code: 'busy' },
    { event: 'tick.slow', room: '3', ms: 34.5 },
    { event: 'step.slow', room: '3', ms: 9.1 },
    { event: 'input.late', room: '3', seat: 0, count: 2 },
    { event: 'drain.started', count: 4 },
    { event: 'drain.done', code: 'empty' },
    { event: 'fatal', code: 'TypeError' },
    { event: 'server.started' },
  ])('accepts %j', (fields) => {
    expect(serverLogLine.safeParse({ ...base, ...fields }).success).toBe(true)
  })

  it.each(['token', 'name', 'ip', 'roomCode', 'payload', 'authorization', 'session', 'message'])(
    'refuses any %s field',
    (field) => {
      expect(serverLogLine.safeParse({ ...base, event: 'seat.joined', [field]: 'x' }).success).toBe(false)
    },
  )

  it.each(['Room.Created', 'r', 'room created', `a${'b'.repeat(48)}`])(
    'refuses the event name %j',
    (event) => {
      expect(serverLogLine.safeParse({ ...base, event }).success).toBe(false)
    },
  )

  it('refuses a room that is not the room serial, such as a room code', () => {
    expect(serverLogLine.safeParse({ ...base, event: 'room.created', room: 'KXQ7PB' }).success).toBe(false)
  })

  it.each(['203.0.113.77', 'fe80::1', 'Bearer fake-token', 'Cannot read properties of undefined', ''])(
    'refuses a code that is not an identifier: %j',
    (code) => {
      expect(serverLogLine.safeParse({ ...base, event: 'refused', code }).success).toBe(false)
    },
  )

  it('refuses a level it does not know and a fractional timestamp', () => {
    expect(serverLogLine.safeParse({ ...base, event: 'fatal', level: 'debug' }).success).toBe(false)
    expect(serverLogLine.safeParse({ ...base, event: 'fatal', ts: 1.5 }).success).toBe(false)
  })
})

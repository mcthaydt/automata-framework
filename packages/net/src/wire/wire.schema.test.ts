import { describe, expect, it } from 'vitest'
import { clientMessageSchema } from './client-message.schema'
import { joinOptionsSchema } from './join-options.schema'
import { serverMessageSchema } from './server-message.schema'

// SV-a (M7 spec §13): every client message and the join options reject an unknown field, a wrong type and a value
// past its bound. The strict rule is FloorFifty's (packages/shared/src/common/schemas.ts at 677d456): "an
// unrecognised field is a rejection rather than a silent strip".

const HASH = '0123456789abcdef'
const join = { protocol: 1, schemaHash: HASH, contentHash: HASH, name: 'Ada' }
const ok = (schema: { safeParse(v: unknown): { success: boolean } }, value: unknown) =>
  schema.safeParse(value).success

describe('JoinOptions', () => {
  it('accepts a join, with and without a session', () => {
    expect(ok(joinOptionsSchema, join)).toBe(true)
    expect(ok(joinOptionsSchema, { ...join, session: 'abc' })).toBe(true)
  })

  it('trims a padded name rather than rejecting it', () => {
    expect(joinOptionsSchema.parse({ ...join, name: '  Ada  ' }).name).toBe('Ada')
  })

  it.each([
    ['an unknown field (FloorFifty: a client-supplied position)', { ...join, x: 3 }],
    ['a wrong type', { ...join, protocol: '1' }],
    ['a fractional protocol', { ...join, protocol: 1.5 }],
    ['a hash that is not 16 hex characters', { ...join, schemaHash: 'ABCDEF0123456789' }],
    ['a short hash', { ...join, contentHash: 'abc' }],
    ['an empty name', { ...join, name: '   ' }],
    ['a name past 16 characters', { ...join, name: 'a'.repeat(17) }],
    ['a name outside the alphabet', { ...join, name: 'Ada<script>' }],
    ['a session past 128 characters', { ...join, session: 'a'.repeat(129) }],
    ['a missing field', { protocol: 1, schemaHash: HASH, name: 'Ada' }],
  ])('rejects %s', (_, value) => {
    expect(ok(joinOptionsSchema, value)).toBe(false)
  })
})

describe('ClientMessage', () => {
  it.each([
    { t: 'cmd', seq: 0, tick: 120, type: 'move', payload: { dx: 1 } },
    { t: 'ping', id: 4, tick: 12.5 },
    { t: 'ping', id: 4, tick: -1 },
    { t: 'ready', ready: true, req: 'r1' },
    { t: 'bot.add', req: 'r2' },
    { t: 'bot.remove', req: 'r3', seat: 2 },
    { t: 'leave', req: 'r4' },
  ])('accepts %o', (message) => {
    expect(ok(clientMessageSchema, message)).toBe(true)
  })

  it.each([
    ['an unknown field on a command', { t: 'cmd', seq: 0, tick: 1, type: 'move', payload: {}, score: 99 }],
    ['an unknown message type', { t: 'win', req: 'r1' }],
    ['a negative seq', { t: 'cmd', seq: -1, tick: 1, type: 'move', payload: {} }],
    ['a fractional tick on a command', { t: 'cmd', seq: 0, tick: 1.5, type: 'move', payload: {} }],
    ['a command type that is not an id', { t: 'cmd', seq: 0, tick: 1, type: 'Move Now', payload: {} }],
    ['a ping tick below -1', { t: 'ping', id: 1, tick: -2 }],
    ['a ready flag that is not a boolean', { t: 'ready', ready: 'yes', req: 'r1' }],
    ['a request id past 64 characters', { t: 'leave', req: 'r'.repeat(65) }],
    ['a request id with a control character', { t: 'leave', req: 'r\n1' }],
    ['a seat past the last one', { t: 'bot.remove', req: 'r1', seat: 16 }],
    ['an unknown field on leave', { t: 'leave', req: 'r1', all: true }],
  ])('rejects %s', (_, value) => {
    expect(ok(clientMessageSchema, value)).toBe(false)
  })
})

describe('ServerMessage', () => {
  it.each([
    { t: 'snap', tick: 30, hash: HASH, acks: { '0': 12, '1': 0 } },
    { t: 'seated', seat: 0 },
    { t: 'pong', id: 4, slack: -3 },
    { t: 'answer', req: 'r1' },
    { t: 'answer', req: 'r1', error: 'ROOM_FULL' },
    { t: 'replay' },
  ])('accepts %o', (message) => {
    expect(ok(serverMessageSchema, message)).toBe(true)
  })

  it.each([
    ['an ack for a seat that is not a number', { t: 'snap', tick: 30, hash: HASH, acks: { a: 1 } }],
    ['an unknown error code', { t: 'answer', req: 'r1', error: 'NOPE' }],
    ['an unknown field', { t: 'seated', seat: 0, host: true }],
  ])('rejects %s', (_, value) => {
    expect(ok(serverMessageSchema, value)).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { type RoomInfo, roomInfoOf, sameRoomInfo } from '#src/features/client/room/room-info.ts'

// The room as a client sees it: the server room's small synchronized state, projected into
// a plain object.

const seat = (index: number, extra: Record<string, unknown> = {}) => ({
  seat: index,
  name: `P${index}`,
  ready: false,
  connected: true,
  bot: false,
  ...extra,
})
const state = (extra: Record<string, unknown> = {}) => ({
  code: 'ABC234',
  phase: 'lobby',
  hostSeat: 0,
  seats: [seat(0), seat(1, { ready: true })],
  ...extra,
})

describe('roomInfoOf', () => {
  it('projects the room state, with your seat from the seated message', () => {
    expect(roomInfoOf(state(), 1)).toEqual({
      code: 'ABC234',
      phase: 'lobby',
      hostSeat: 0,
      you: 1,
      seats: [seat(0), seat(1, { ready: true })],
    })
  })

  it('reads a host seat of -1 as no host, and no seated message as no seat', () => {
    const info = roomInfoOf(state({ hostSeat: -1 }), undefined)
    expect(info?.hostSeat).toBeUndefined()
    expect(info?.you).toBeUndefined()
  })

  it('reads a Colyseus schema through its toJSON, and holds no reference to it', () => {
    const raw = state()
    const schema = { toJSON: () => raw, code: 'IGNORED' }
    const info = roomInfoOf(schema, 0)
    expect(info?.code).toBe('ABC234')
    expect(Object.getPrototypeOf(info)).toBe(Object.prototype)
    expect(info?.seats[0]).not.toBe(raw.seats[0])
    expect(Object.isFrozen(info)).toBe(true)
    expect(Object.isFrozen(info?.seats)).toBe(true)
    expect(Object.isFrozen(info?.seats[0])).toBe(true)
  })

  it.each([
    ['an empty state (before the first patch)', {}],
    ['an unknown phase', state({ phase: 'racing' })],
    ['a code that is empty', state({ code: '' })],
    ['a seat with a missing field', state({ seats: [{ seat: 0 }] })],
    ['not an object', 'lobby'],
  ])('refuses %s', (_, value) => {
    expect(roomInfoOf(value, 0)).toBeUndefined()
  })
})

describe('sameRoomInfo', () => {
  it('compares by value', () => {
    const a = roomInfoOf(state(), 0) as RoomInfo
    expect(sameRoomInfo(a, roomInfoOf(state(), 0))).toBe(true)
    expect(sameRoomInfo(a, roomInfoOf(state(), 1))).toBe(false)
    expect(sameRoomInfo(a, roomInfoOf(state({ seats: [seat(0)] }), 0))).toBe(false)
    expect(sameRoomInfo(a, roomInfoOf(state({ seats: [seat(0), seat(1)] }), 0))).toBe(false)
    expect(sameRoomInfo(a, undefined)).toBe(false)
    expect(sameRoomInfo(undefined, undefined)).toBe(true)
  })
})

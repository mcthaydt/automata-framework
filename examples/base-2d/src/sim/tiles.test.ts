import { describe, expect, it } from 'vitest'
import { readRoomGrid } from '../content/room-grid.ts'
import { FIRST_ROOM, roomOf } from './tiles.ts'

// roomOf is the one place the sim's untyped content becomes a RoomGrid, so anything that is not a room fails
// here, naming the room, instead of as NaN positions on the first step.
const room = readRoomGrid(8, ['######', '#....#', '#.P.G#', '######'])
const contentWith = (value: unknown) => ({ rooms: { [FIRST_ROOM]: value } })

describe('roomOf', () => {
  it('returns the first room of the content', () => {
    expect(roomOf(contentWith(room))).toBe(room)
  })

  it.each([
    ['no content', null],
    ['no rooms', {}],
    ['no first room', { rooms: {} }],
  ])('refuses %s', (_name, content) => {
    expect(() => roomOf(content)).toThrow(`no room ${FIRST_ROOM}`)
  })

  it.each([
    ['tileSize', { ...room, tileSize: '8' }],
    ['width', { ...room, width: undefined }],
    ['height', { ...room, height: undefined }],
    ['rows', { ...room, rows: 'not rows' }],
    ['goal', { ...room, goal: {} }],
    ['start', { ...room, start: undefined }],
  ])('refuses a room with a bad %s', (_field, broken) => {
    expect(() => roomOf(contentWith(broken))).toThrow(`no room ${FIRST_ROOM}`)
  })
})

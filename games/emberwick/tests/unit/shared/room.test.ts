import { describe, expect, it } from 'vitest'
import { isSolid, parseRoom, type RoomSource } from '#src/shared/room.ts'
import { ROOM } from '../../../fixtures/hand-written-room.ts'

const tiny = (rows: string[]): RoomSource => ({ id: 'tiny', tileSize: 8, rows })

describe('the room', () => {
  it('is 40 by 24 tiles of 8 pixels with one start and one goal', () => {
    const room = parseRoom(ROOM)
    expect(room.width).toBe(40)
    expect(room.height).toBe(24)
    expect(room.tileSize).toBe(8)
    expect(isSolid(room, room.start.tx, room.start.ty)).toBe(false)
    expect(isSolid(room, room.goal.tx, room.goal.ty)).toBe(false)
    // The start stands on the floor: the tile below it is solid.
    expect(isSolid(room, room.start.tx, room.start.ty + 1)).toBe(true)
  })

  it('finds the start and the goal', () => {
    const room = parseRoom(tiny(['####', '#..#', '#PG#', '####']))
    expect(room.start).toEqual({ tx: 1, ty: 2 })
    expect(room.goal).toEqual({ tx: 2, ty: 2 })
  })

  it('treats everything outside the room as solid', () => {
    const room = parseRoom(tiny(['....', '.PG.', '....', '....']))
    expect(isSolid(room, -1, 0)).toBe(true)
    expect(isSolid(room, 4, 0)).toBe(true)
    expect(isSolid(room, 0, -1)).toBe(true)
    expect(isSolid(room, 0, 4)).toBe(true)
    expect(isSolid(room, 0, 0)).toBe(false)
  })

  it('rejects ragged rows, naming the row', () => {
    expect(() => parseRoom(tiny(['####', '#..#', '#PG', '####']))).toThrow(
      'row 2 is 3 tiles wide, expected 4',
    )
  })

  it('rejects unknown tiles, naming where they are', () => {
    expect(() => parseRoom(tiny(['####', '#..#', '#PGx', '####']))).toThrow(
      'unknown tile "x" at column 3, row 2',
    )
  })

  it('needs room above the start for the character, who is a tile and a half tall', () => {
    expect(() => parseRoom(tiny(['####', '#PG#', '####']))).toThrow(
      'the tile above P (column 1, row 0) must be empty',
    )
  })

  it('needs exactly one start and one goal', () => {
    expect(() => parseRoom(tiny(['####', '#..#', '#PP#', '#G.#']))).toThrow('needs exactly one P, found 2')
    expect(() => parseRoom(tiny(['####', '#..#', '#P.#', '####']))).toThrow('needs exactly one G, found 0')
  })
})

import { describe, expect, it } from 'vitest'
import { roomSchema } from '../../room.schema.ts'

// A small valid room: walls round 40 × 8 tiles, Wick on the floor (P) and the ember (G) in the air.
const WALL = '#'.repeat(40)
const AIR = `#${'.'.repeat(38)}#`
const at = (row: string, column: number, tile: string): string =>
  `${row.slice(0, column)}${tile}${row.slice(column + 1)}`
const ROOM = {
  tileSize: 8,
  rows: [WALL, at(AIR, 20, 'G'), AIR, AIR, AIR, AIR, at(AIR, 3, 'P'), WALL],
}

const issues = (rows: readonly string[]) => {
  const result = roomSchema.schema.safeParse({ id: 'room', tileSize: ROOM.tileSize, rows })
  return result.success
    ? []
    : result.error.issues.map((issue) => ({ path: issue.path, message: issue.message }))
}

describe('the room schema', () => {
  it("accepts the base's room", () => {
    expect(issues(ROOM.rows)).toEqual([])
  })

  it('points a bad tile at its row, so the compiler reports the line in room.toml', () => {
    const rows = [...ROOM.rows]
    rows[5] = `${(rows[5] as string).slice(0, -2)}?#`
    expect(issues(rows)).toEqual([
      { path: ['rows', 5], message: 'room room: unknown tile "?" at column 38, row 5' },
    ])
  })

  it('points a rule about the whole room at its rows', () => {
    const rows = ROOM.rows.map((row) => row.replace('G', '.'))
    expect(issues(rows)).toEqual([{ path: ['rows'], message: 'room room: needs exactly one G, found 0' }])
  })
})

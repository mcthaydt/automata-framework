import { describe, expect, it } from 'vitest'
import { ROOM, parseRoom } from '../../automata-framework/games/emberwick/src/content/room'
import { withStart } from '../workshop/spawn'

describe('A first AI change: configurable player start', () => {
  it('moves the start to the chosen column while preserving the room and goal', () => {
    const changed = withStart(ROOM, 18)
    const before = parseRoom(ROOM)
    const after = parseRoom(changed)
    expect(after.start).toEqual({ tx: 18, ty: before.start.ty })
    expect(after.goal).toEqual(before.goal)
    expect(after.width).toBe(before.width)
    expect(after.height).toBe(before.height)
  })
  it('keeps the original content unchanged', () => {
    const original = JSON.stringify(ROOM)
    withStart(ROOM, 18)
    expect(JSON.stringify(ROOM)).toBe(original)
    expect(parseRoom(ROOM).start.tx).toBe(6)
  })
  it('rejects a wall instead of silently changing level geometry', () => {
    expect(() => withStart(ROOM, 30)).toThrow('empty tile')
  })
  it('rejects fractional and out-of-bounds columns', () => {
    for (const column of [-1, 40, 1.5, NaN]) expect(() => withStart(ROOM, column)).toThrow('column')
  })
  it('produces the same content for the same input', () => {
    expect(withStart(ROOM, 18)).toEqual(withStart(ROOM, 18))
  })
})

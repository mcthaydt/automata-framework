import { describe, expect, it } from 'vitest'
import { parseRoom, type RoomSource } from '#src/content/room.ts'
import { planTiles } from '#src/render/tiles.ts'
import { ROOM } from '../../../fixtures/hand-written-room.ts'

const room = (rows: string[]): RoomSource => ({ id: 'test', tileSize: 8, rows })
const BOX = parseRoom(room(['......', '......', '.P..G.', '.####.', '......']))

describe('the tile plan', () => {
  it('lays stone on every solid tile and nothing on open ones', () => {
    const plan = planTiles(BOX)
    expect(plan.stone.map(({ tx, ty }) => [tx, ty])).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
      [4, 3],
    ])
  })

  it('caps open tops with moss and shades open sides and undersides', () => {
    const plan = planTiles(BOX)
    expect(plan.overlays).toContainEqual({ tx: 1, ty: 3, piece: 'mossTop' })
    expect(plan.overlays).toContainEqual({ tx: 1, ty: 3, piece: 'edgeLeft' })
    expect(plan.overlays).toContainEqual({ tx: 4, ty: 3, piece: 'edgeRight' })
    expect(plan.overlays).toContainEqual({ tx: 2, ty: 3, piece: 'edgeBottom' })
    expect(plan.overlays).not.toContainEqual({ tx: 2, ty: 3, piece: 'edgeLeft' })
  })

  it('treats the room’s outside as solid, so border walls get no outer edge', () => {
    const plan = planTiles(parseRoom(ROOM))
    expect(plan.overlays).not.toContainEqual({ tx: 0, ty: 10, piece: 'edgeLeft' })
    expect(plan.overlays).toContainEqual({ tx: 0, ty: 10, piece: 'edgeRight' })
  })

  it('places grass, mushrooms and vines only where they fit, the same way every time', () => {
    const shipped = parseRoom(ROOM)
    const plan = planTiles(shipped)
    expect(planTiles(shipped)).toEqual(plan)
    const solid = (tx: number, ty: number) => shipped.rows[ty]?.charAt(tx) === '#'
    for (const { tx, ty } of [...plan.grass, ...plan.mushrooms]) {
      expect(solid(tx, ty)).toBe(false)
      expect(solid(tx, ty + 1)).toBe(true)
    }
    for (const { tx, ty } of plan.vines) expect(solid(tx, ty)).toBe(false)
    expect(plan.grass.length).toBeGreaterThan(0)
    expect(plan.mushrooms.length).toBeGreaterThan(0)
    expect(plan.vines.length).toBeGreaterThan(0)
  })

  it('keeps decorations off the start and the goal', () => {
    const shipped = parseRoom(ROOM)
    const plan = planTiles(shipped)
    for (const { tx, ty } of [...plan.grass, ...plan.mushrooms, ...plan.vines]) {
      expect([tx, ty]).not.toEqual([shipped.start.tx, shipped.start.ty])
      expect([tx, ty]).not.toEqual([shipped.goal.tx, shipped.goal.ty])
    }
  })
})

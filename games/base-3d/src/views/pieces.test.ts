// The dungeon pieces as placeholder boxes (GAME-3D.1i): a chest, a pot, a cracked wall, a plate or eye and a block
// each stand as a box the size of their row; a hidden chest is not drawn; a switch that is on is lit. The art is
// GAME-3D.1j's (it waits on the figure and prop editors).
import { describe, expect, it } from 'vitest'
import { areaOfPoint, pieceDrawn } from './pieces.ts'

const Q16 = 65_536
const box = { minX: 1 * Q16, minZ: 2 * Q16, maxX: 2 * Q16, maxZ: 4 * Q16 }

describe('pieceDrawn', () => {
  it('draws a chest from its box, only while shown, shorter once open', () => {
    const shut = pieceDrawn('chest', 'chest', { ...box, shown: true, open: false })
    expect(shut).toMatchObject({ visible: true, min: [1, 0, 2], max: [2, 0.7, 4] })
    expect(pieceDrawn('chest', 'chest', { ...box, shown: false, open: false }).visible).toBe(false)
    expect(pieceDrawn('chest', 'chest', { ...box, shown: true, open: true }).max[1]).toBeLessThan(0.7)
  })

  it('draws a plate flat on the floor and lit when on, an eye on the wall at its height', () => {
    const off = pieceDrawn('switch', 'plate', { ...box, on: false })
    const on = pieceDrawn('switch', 'plate', { ...box, on: true })
    expect(off.max[1]).toBeLessThan(0.1)
    expect(on.colour).not.toBe(off.colour)
    expect(pieceDrawn('switch', 'eye', { ...box, on: false }).min[1]).toBeGreaterThan(1)
  })

  it('draws a block from its centre, a pot and a cracked wall from their box', () => {
    const block = pieceDrawn('block', 'block', { x: 3 * Q16, z: 5 * Q16 })
    expect(block).toMatchObject({ min: [2.5, 0, 4.5], max: [3.5, 1, 5.5] })
    expect(pieceDrawn('breakable', 'pot', box).max[1]).toBeLessThan(1)
    expect(pieceDrawn('breakable', 'cracked', box).max[1]).toBeGreaterThan(2)
  })
})

describe('areaOfPoint', () => {
  const rooms = (x0: number, x1: number) => [{ minX: x0 * Q16, maxX: x1 * Q16, minZ: 0, maxZ: 10 * Q16 }]
  const areas = [{ rooms: rooms(-4, 4) }, { rooms: rooms(94, 106) }]
  it('finds the area whose rooms hold the point, doorways on a room’s edge included', () => {
    expect(areaOfPoint(areas, 0, 5)).toBe(areas[0])
    expect(areaOfPoint(areas, 100, 10)).toBe(areas[1])
    expect(areaOfPoint(areas, 50, 5)).toBeUndefined()
  })
})

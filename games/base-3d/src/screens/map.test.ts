// The Map screen's plan from the compiled area (DESIGN.md §9.4, GAME-3D.1e part 5c): rooms here, visited or outlined,
// the walls, Wick's arrow and the camera's heading, in metres with north (+z) up.
import { describe, expect, it } from 'vitest'
import { metres } from '../constants/index.ts'
import { FIRST_AREA } from '../testing/sim.ts'
import { mapOf } from './map.ts'

const at = (overrides: Partial<Parameters<typeof mapOf>[1]> = {}): Parameters<typeof mapOf>[1] => ({
  x: metres(0),
  z: metres(-2),
  facing: 0,
  heading: 0,
  visited: [],
  hasMap: false,
  ...overrides,
})

describe('mapOf', () => {
  it('draws the room Wick stands in, and leaves out an unvisited room without the map', () => {
    const plan = mapOf(FIRST_AREA, at())
    expect(plan.rooms).toEqual([{ id: 'hall', minX: -4, minZ: -4, maxX: 4, maxZ: 4, state: 'here' }])
  })

  it('outlines an unvisited room with the map, and fills a visited one', () => {
    expect(mapOf(FIRST_AREA, at({ hasMap: true })).rooms.map((room) => [room.id, room.state])).toEqual([
      ['hall', 'here'],
      ['kiln', 'outline'],
    ])
    expect(mapOf(FIRST_AREA, at({ visited: ['kiln'] })).rooms.map((room) => [room.id, room.state])).toEqual([
      ['hall', 'here'],
      ['kiln', 'visited'],
    ])
    expect(
      mapOf(FIRST_AREA, at({ x: metres(1), z: metres(8), visited: ['hall'] })).rooms.map(
        (room) => room.state,
      ),
    ).toEqual(['visited', 'here'])
  })

  it('bounds the plan by every room, so the map keeps its scale as rooms appear', () => {
    expect(mapOf(FIRST_AREA, at()).bounds).toEqual({ minX: -4, minZ: -4, maxX: 4, maxZ: 12 })
  })

  it('places Wick in metres, and turns his facing and the camera’s heading into degrees clockwise from north', () => {
    const plan = mapOf(FIRST_AREA, at({ facing: 16_384, heading: 49_152 }))
    expect(plan.wick).toEqual({ x: 0, z: -2, facingDeg: 90 })
    expect(plan.headingDeg).toBe(270)
  })

  it('keeps only the walls that touch a room it draws', () => {
    const walls = mapOf(FIRST_AREA, at()).walls
    expect(walls.length).toBeGreaterThan(0)
    expect(walls.length).toBeLessThan(FIRST_AREA.walls.length)
    expect(mapOf(FIRST_AREA, at({ hasMap: true })).walls).toHaveLength(FIRST_AREA.walls.length)
  })
})

// The Map screen's plan from the compiled area (DESIGN.md §9.4, GAME-3D.1e part 5c): rooms here, visited or outlined,
// the walls, Wick's arrow and the camera's heading, in metres with north (+z) up.
import { describe, expect, it } from 'vitest'
import { metres } from '../constants/index.ts'
import { FIRST_SLICE } from '../content/first-slice.ts'
import { compileArea } from '../systems/index.ts'
import { FIRST_AREA } from '../testing/sim.ts'
import { mapOf } from './map.ts'

const at = (overrides: Partial<Parameters<typeof mapOf>[1]> = {}): Parameters<typeof mapOf>[1] => ({
  x: metres(0),
  z: metres(-2),
  facing: 0,
  heading: 0,
  visited: [],
  hasMap: false,
  hasCompass: false,
  flags: [],
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

  /** The first slice with a door of each lock on the hall's north edge, one inside the kiln, two chests and a Warden. */
  const PIECES = compileArea({
    ...FIRST_SLICE,
    foes: [{ kind: 'warden', x: 0, z: 9, facing: 0 }],
    entities: [
      { def: 'switch', id: 'plate', x: -3, z: 2, kind: 'plate' },
      { def: 'door', id: 'key', x: -3, z: 4, width: 1, depth: 0.3, lock: 'small-key' },
      { def: 'door', id: 'boss', x: -1, z: 4, width: 1, depth: 0.3, lock: 'boss-key' },
      { def: 'door', id: 'bars', x: 1, z: 4, width: 1, depth: 0.3, lock: 'clear' },
      { def: 'door', id: 'link', x: 3, z: 4, width: 1, depth: 0.3, lock: 'switch', switch: 'plate' },
      { def: 'door', id: 'deep', x: 0, z: 10, width: 1, depth: 0.3, lock: 'none' },
      { def: 'chest', id: 'loot', x: 2, z: -2, contents: 'map' },
      { def: 'chest', id: 'far', x: 2, z: 8, contents: 'compass' },
    ],
  })

  it('draws each door of a drawn room with its lock kind, and open once the save has it (§6.5’s legend)', () => {
    const plan = mapOf(PIECES, at({ flags: ['first-slice/bars'] }))
    expect(plan.doors.map((door) => [door.id, door.lock, door.open])).toEqual([
      ['key', 'small-key', false],
      ['boss', 'boss-key', false],
      ['bars', 'clear', true],
      ['link', 'switch', false],
    ])
    // Its box in metres, to the sim's fixed point (Q16.16).
    const [first] = plan.doors
    expect(first).toMatchObject({ minX: -3.5, maxX: -2.5 })
    expect(first?.minZ).toBeCloseTo(3.85, 4)
    expect(first?.maxZ).toBeCloseTo(4.15, 4)
    // The switch door's link runs to its switch.
    expect(plan.doors[3]?.link).toEqual({ x: -3, z: 2 })
    expect(mapOf(PIECES, at({ hasMap: true })).doors.map((door) => door.id)).toContain('deep')
  })

  it('marks the chests, open or closed, and the boss room only with the compass', () => {
    expect(mapOf(PIECES, at({ hasMap: true })).chests).toEqual([])
    expect(mapOf(PIECES, at({ hasMap: true })).boss).toBeUndefined()
    const plan = mapOf(PIECES, at({ hasCompass: true, flags: ['first-slice/loot'] }))
    expect(plan.chests).toEqual([
      { id: 'loot', x: 2, z: -2, open: true },
      { id: 'far', x: 2, z: 8, open: false },
    ])
    expect(plan.boss).toEqual({ room: 'kiln', x: 0, z: 8 })
  })
})

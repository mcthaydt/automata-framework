import { describe, expect, it } from 'vitest'
import { metres, ROLL, TICK_HZ, WALK_SPEED } from './constants/index.ts'
import { ROOM } from './content/room.ts'
import { heroFigureState, placed, sceneOf } from './views/index.ts'

// base-3d's views: Wick's rows to the figure view's state, Q16.16 rows to metres for the views, and the room to its walls,
// floors and ceilings. Presentation: the sim never reads them back (law 1).
const hero = { x: 0, z: 0, facing: 0, moving: false, moveDir: 0 }
const idleAction = { clip: 0, startedAt: 0, pushX: 0, pushZ: 0, pushTicks: 0 }

describe('heroFigureState', () => {
  it('stands, then walks at the walk speed when moving', () => {
    expect(heroFigureState({ hero, 'hero-action': idleAction })).toMatchObject({ moving: false, speed: 0 })
    expect(heroFigureState({ hero: { ...hero, moving: true }, 'hero-action': idleAction })).toMatchObject({
      moving: true,
      speed: WALK_SPEED,
    })
  })

  it('plays the roll’s clip from the tick it started, retimed to the roll’s length, and does not also walk', () => {
    const state = heroFigureState({
      hero: { ...hero, moving: true },
      'hero-action': { ...idleAction, clip: 1, startedAt: 120 },
    })
    expect(state.action).toEqual({ id: 'roll', length: ROLL.ticks / TICK_HZ, startedAt: 2 })
    expect(state.speed).toBe(0)
  })
})

describe('placed', () => {
  it('turns a Q16.16 row into metres on the floor, facing in radians', () => {
    const pose = placed({ x: metres(2), z: metres(-1), facing: 16_384 })
    expect(pose).toMatchObject({ x: 2, y: 0, z: -1 })
    expect(pose.yaw).toBeCloseTo(Math.PI / 2, 12)
    // A row with no facing faces the way it is given.
    expect(placed({ x: 0, z: 0 }, 1).yaw).toBe(1)
  })
})

describe('sceneOf the room', () => {
  const scene = sceneOf(ROOM)

  it('draws one wall per area wall, its height above the 2 m camera bounds', () => {
    expect(scene.walls).toHaveLength(ROOM.walls.length)
    for (const wall of scene.walls) expect(wall.height).toBeGreaterThan(2)
  })

  it('lays a floor and a ceiling over each room, and none over a pit, so a channel shows as a gap', () => {
    expect(scene.floors).toHaveLength(ROOM.rooms.length)
    expect(scene.ceilings).toHaveLength(ROOM.rooms.length)
    for (const pit of ROOM.pits)
      for (const floor of scene.floors)
        expect(floor.max[2] <= pit.min[1] || floor.min[2] >= pit.max[1]).toBe(true)
  })
})

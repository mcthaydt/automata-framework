import { content } from 'virtual:automata/content'
import { describe, expect, it } from 'vitest'
import { ROOM, roomWorld } from '#src/features/room/room.ts'
import { heroFigureState, lipBoxes, placed } from '#src/features/scene/scene.ts'
import { metres, TICK_HZ } from '#src/shared/constants.ts'
import { TUNING } from '#src/testing/sim.ts'

// base-3d's views: Wick's rows to the figure view's state, Q16.16 rows to metres for the views, and the room’s world and lips. Presentation: the sim never reads them back (law 1).
const hero = { x: 0, z: 0, facing: 0, moving: false, moveDir: 0 }
const idleAction = { clip: 0, startedAt: 0, pushX: 0, pushZ: 0, pushTicks: 0 }

describe('heroFigureState', () => {
  it('stands, then walks at the walk speed when moving', () => {
    expect(heroFigureState({ hero, 'hero-action': idleAction }, TUNING)).toMatchObject({
      moving: false,
      speed: 0,
    })
    const walking = heroFigureState({ hero: { ...hero, moving: true }, 'hero-action': idleAction }, TUNING)
    expect(walking.moving).toBe(true)
    // 4,369 a tick at 60 ticks a second is 3.9998 m/s: the tuning's whole numbers, in metres a second.
    expect(walking.speed).toBeCloseTo(4, 3)
  })

  it('plays the roll’s clip from the tick it started, retimed to the roll’s length, and does not also walk', () => {
    const state = heroFigureState(
      { hero: { ...hero, moving: true }, 'hero-action': { ...idleAction, clip: 1, startedAt: 120 } },
      TUNING,
    )
    expect(state.action).toEqual({ id: 'roll', length: TUNING.ROLL_TICKS / TICK_HZ, startedAt: 2 })
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

describe('the room’s world', () => {
  const ROOM_WORLD = roomWorld(content).world
  const pieces = (part: string) => ROOM_WORLD.pieces.filter((piece) => piece.part === part)

  it('builds with nothing to report: every surface the file names is in the library', () => {
    expect(ROOM_WORLD.problems).toEqual([])
  })

  it('lays a floor and a ceiling over every sector, the channels’ floors in lava', () => {
    expect(pieces('floor')).toHaveLength(ROOM.rooms.length + ROOM.pits.length)
    expect(pieces('ceiling')).toHaveLength(ROOM.rooms.length + ROOM.pits.length)
    const lava = pieces('floor').filter((piece) => piece.surface === 'lava')
    expect(lava.map((piece) => piece.sector)).toEqual(['channel-1', 'channel-2'])
  })

  it('stands every wall face above the 2 m camera bounds, and steps a channel down from its platforms', () => {
    const faces = pieces('wall').filter((piece) => piece.line !== undefined)
    expect(faces.length).toBeGreaterThan(0)
    const tops = faces.map((face) => Math.max(...face.mesh.positions.filter((_, i) => i % 3 === 1)))
    for (const top of tops) expect(top).toBeGreaterThan(2)
    // A channel’s floor is 3 m under its platforms: the step up to them is drawn from the channel’s side.
    const steps = pieces('wall').filter(
      (piece) => piece.id.includes(':lower:') && piece.sector.startsWith('channel'),
    )
    expect(steps).toHaveLength(4)
  })
})

describe('lipBoxes', () => {
  it('lays a bright lip along both edges of each channel', () => {
    const boxes = lipBoxes(ROOM)
    expect(boxes).toHaveLength(ROOM.pits.length * 2)
    expect(new Set(boxes.map((entry) => entry.colour)).size).toBe(1)
    for (const lip of boxes) expect(lip.box.max[1]).toBeLessThan(0.2)
  })
})

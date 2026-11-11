// Which rooms a view draws: the static answer for a view (`drawnRooms`), a view that names a room the level lacks, and the
// four things that change it from frame to frame (`createRoomDraw`): the player's own room is always drawn, the room just
// left stays drawn for 0.35 s under the camera's blend, a peek draws the far side of the doorway, and a cutscene draws every
// room.
import { describe, expect, it } from 'vitest'
import { buildWorld } from '#src/features/world/build.ts'
import { createRoomDraw, drawnRooms, ROOM_HOLD, viewRoomProblems } from '#src/features/world/room-draw.ts'
import type { AfSector2 } from '#src/shared/level/af-sector-2.schema.ts'

const room = (id: string, x0: number, z0: number) => ({
  id,
  floor: { z: 0 },
  ceiling: { z: 3 },
  light: 1,
  corners: [
    [x0, z0],
    [x0 + 4, z0],
    [x0 + 4, z0 + 4],
    [x0, z0 + 4],
  ] as [number, number][],
})

/**
 * Three rooms in an L: `a` at the corner, `b` east of it and `c` north of it. Mass 0 stands on the wall between `a` and `c`
 * (it touches both); mass 1 is inside `b` alone; mass 2 is clear of every room.
 */
const level: AfSector2 = {
  format: 'af-sector/2',
  name: 't',
  sectors: [room('a', 0, 0), room('b', 4, 0), room('c', 0, 4)],
  masses: [
    {
      points: [
        { x: 1, z: 3.9 },
        { x: 3, z: 3.9 },
        { x: 3, z: 4.1 },
        { x: 1, z: 4.1 },
      ],
      top: 3,
    },
    {
      points: [
        { x: 5, z: 1 },
        { x: 7, z: 1 },
        { x: 7, z: 3 },
        { x: 5, z: 3 },
      ],
      top: 3,
    },
    {
      points: [
        { x: 20, z: 20 },
        { x: 22, z: 20 },
        { x: 22, z: 22 },
      ],
      top: 3,
    },
  ],
  views: {
    ab: { rooms: ['a', 'b'] },
    onlyA: { rooms: ['a'] },
    onlyB: { rooms: ['b'] },
    onlyC: { rooms: ['c'] },
    everything: {},
    ghost: { rooms: ['a', 'z'] },
  },
}
const names = (set: ReadonlySet<string>): string[] => [...set].sort()
const A = { x: 2, z: 2 }
const B = { x: 6, z: 2 }
const C = { x: 2, z: 6 }

describe('drawnRooms', () => {
  it('a view with rooms draws those two and not the third', () => {
    expect(names(drawnRooms(level, 'ab').sectors)).toEqual(['a', 'b'])
  })

  it('a view with no rooms draws all three', () => {
    expect(names(drawnRooms(level, 'everything').sectors)).toEqual(['a', 'b', 'c'])
  })

  it('no view, or a view the level does not have, draws every room', () => {
    expect(names(drawnRooms(level, undefined).sectors)).toEqual(['a', 'b', 'c'])
    expect(names(drawnRooms(level, 'nowhere').sectors)).toEqual(['a', 'b', 'c'])
    expect(names(drawnRooms({ ...level, views: undefined }, 'ab').sectors)).toEqual(['a', 'b', 'c'])
  })

  it('a mass between a and c is drawn when either is', () => {
    expect([...drawnRooms(level, 'onlyA').masses]).toEqual([0])
    expect([...drawnRooms(level, 'onlyC').masses]).toEqual([0])
    expect([...drawnRooms(level, 'onlyB').masses]).toEqual([1])
  })

  it('a mass touching no drawn room is not drawn; a view that names no rooms draws every mass', () => {
    expect([...drawnRooms(level, 'ab').masses].sort()).toEqual([0, 1])
    expect([...drawnRooms(level, 'everything').masses].sort()).toEqual([0, 1, 2])
    expect([...drawnRooms(level, undefined).masses].sort()).toEqual([0, 1, 2])
  })
})

describe('viewRoomProblems', () => {
  it('says in words which view names which room the level lacks, and what it has', () => {
    const [problem, ...rest] = viewRoomProblems(level)
    expect(rest).toEqual([])
    expect(problem).toMatchObject({
      path: ['views', 'ghost', 'rooms', 1],
      code: 'unknown-view-room',
      where: 'ghost',
      name: 'z',
    })
    expect(problem?.message).toBe(
      'the camera view "ghost" draws the room "z", which the level does not have (rooms: a, b, c)',
    )
  })

  it('is empty for a level whose views name only its rooms, or that has none', () => {
    expect(viewRoomProblems({ ...level, views: { ab: { rooms: ['a', 'b'] } } })).toEqual([])
    expect(viewRoomProblems({ ...level, views: undefined })).toEqual([])
  })

  it('reaches the world builder’s problems', () => {
    const { problems } = buildWorld(level, { swatches: { oakFloor: {}, plasterWarm: {}, trimWhite: {} } })
    expect(problems.filter((p) => p.code === 'unknown-view-room')).toHaveLength(1)
  })
})

describe('createRoomDraw: what each frame draws', () => {
  it('draws the view’s rooms, and the same level and view always give the same rooms', () => {
    const draw = createRoomDraw(level)
    expect(names(draw.update({ view: 'ab', at: A, dt: 0.016 }).sectors)).toEqual(['a', 'b'])
    expect(names(draw.update({ view: 'ab', at: A, dt: 0.016 }).sectors)).toEqual(['a', 'b'])
  })

  it('the player’s own room is always drawn, whatever the view names', () => {
    const draw = createRoomDraw(level)
    expect(names(draw.update({ view: 'onlyA', at: C, dt: 0.016 }).sectors)).toEqual(['a', 'c'])
    expect(names(draw.update({ view: 'onlyA', at: A, dt: 0.016 }).sectors)).toContain('a')
  })

  it('a player outside every room adds none, and no player is no room', () => {
    const draw = createRoomDraw(level)
    expect(names(draw.update({ view: 'onlyA', at: { x: 50, z: 50 }, dt: 0.016 }).sectors)).toEqual(['a'])
    expect(names(draw.update({ view: 'onlyA', at: undefined, dt: 0.016 }).sectors)).toEqual(['a'])
  })

  it('the room just left stays drawn for 0.35 s under the camera blend, and then goes', () => {
    expect(ROOM_HOLD).toBe(0.35)
    const draw = createRoomDraw(level)
    draw.update({ view: 'onlyA', at: A, dt: 0.016 })
    // The player crosses into b and the view changes with them.
    expect(names(draw.update({ view: 'onlyB', at: B, dt: 0.016 }).sectors)).toEqual(['a', 'b'])
    expect(names(draw.update({ view: 'onlyB', at: B, dt: 0.3 }).sectors)).toEqual(['a', 'b'])
    expect(names(draw.update({ view: 'onlyB', at: B, dt: 0.03 }).sectors)).toEqual(['a', 'b'])
    expect(names(draw.update({ view: 'onlyB', at: B, dt: 0.03 }).sectors)).toEqual(['b'])
  })

  it('a room come back to before the hold runs out is drawn as a view’s own and is not held a second time', () => {
    const draw = createRoomDraw(level)
    draw.update({ view: 'onlyA', at: A, dt: 0.016 })
    draw.update({ view: 'onlyB', at: B, dt: 0.016 })
    draw.update({ view: 'onlyA', at: A, dt: 0.1 })
    // b is the one just left now; it holds for the full 0.35 s from here, and a is drawn throughout.
    expect(names(draw.update({ view: 'onlyA', at: A, dt: 0.3 }).sectors)).toEqual(['a', 'b'])
    expect(names(draw.update({ view: 'onlyA', at: A, dt: 0.06 }).sectors)).toEqual(['a'])
  })

  it('the masses follow the rooms held over, too', () => {
    const draw = createRoomDraw(level)
    draw.update({ view: 'onlyC', at: C, dt: 0.016 })
    const held = draw.update({ view: 'onlyB', at: B, dt: 0.016 })
    expect([...held.masses].sort()).toEqual([0, 1])
    expect([...draw.update({ view: 'onlyB', at: B, dt: 0.4 }).masses]).toEqual([1])
  })

  it('a peek draws the far side of the doorway', () => {
    const draw = createRoomDraw(level)
    expect(names(draw.update({ view: 'onlyA', at: A, dt: 0.016 }).sectors)).toEqual(['a'])
    expect(names(draw.update({ view: 'onlyA', at: A, peek: B, dt: 0.016 }).sectors)).toEqual(['a', 'b'])
    // The far room is the camera's for as long as it is leaning, and holds for the blend back after it lets go.
    expect(names(draw.update({ view: 'onlyA', at: A, peek: B, dt: 0.5 }).sectors)).toEqual(['a', 'b'])
    expect(names(draw.update({ view: 'onlyA', at: A, dt: 0.2 }).sectors)).toEqual(['a', 'b'])
    expect(names(draw.update({ view: 'onlyA', at: A, dt: 0.4 }).sectors)).toEqual(['a'])
  })

  it('a cutscene draws every room, and forgets what it held', () => {
    const draw = createRoomDraw(level)
    draw.update({ view: 'onlyA', at: A, dt: 0.016 })
    draw.update({ view: 'onlyB', at: B, dt: 0.016 })
    expect(names(draw.update({ view: 'onlyB', at: B, cutscene: true, dt: 0.016 }).sectors)).toEqual([
      'a',
      'b',
      'c',
    ])
    // After it, the view alone and the player: the a held from before is long gone with it.
    expect(names(draw.update({ view: 'onlyB', at: B, dt: 0.016 }).sectors)).toEqual(['b'])
  })

  it('a cutscene draws every mass too', () => {
    const draw = createRoomDraw(level)
    expect([...draw.update({ view: 'onlyA', at: A, cutscene: true, dt: 0.016 }).masses].sort()).toEqual([
      0, 1, 2,
    ])
  })

  it('without a view it draws everything and holds nothing back', () => {
    const draw = createRoomDraw(level)
    expect(names(draw.update({ view: undefined, at: A, dt: 0.016 }).sectors)).toEqual(['a', 'b', 'c'])
    expect(names(draw.update({ view: 'onlyA', at: A, dt: 0.016 }).sectors)).toEqual(['a', 'b', 'c'])
    expect(names(draw.update({ view: 'onlyA', at: A, dt: 0.4 }).sectors)).toEqual(['a'])
  })

  it('a step that is negative or not a number counts as none, and reset forgets the held rooms', () => {
    const draw = createRoomDraw(level)
    draw.update({ view: 'onlyA', at: A, dt: 0.016 })
    draw.update({ view: 'onlyB', at: B, dt: 0.016 })
    expect(names(draw.update({ view: 'onlyB', at: B, dt: -5 }).sectors)).toEqual(['a', 'b'])
    expect(names(draw.update({ view: 'onlyB', at: B, dt: Number.NaN }).sectors)).toEqual(['a', 'b'])
    draw.reset()
    expect(names(draw.update({ view: 'onlyB', at: B, dt: 0.016 }).sectors)).toEqual(['b'])
  })
})

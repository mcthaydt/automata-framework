// The level converter (GAME-3D.1i, DESIGN.md §17): an `af-sector` file (either format) read as an `AreaSource`. Rectangular sectors
// only in 1.0; a file that cannot be read fails naming the file and the JSON path (G3-F2).
import { WALL_THICK } from '@automata/3d/level'
import { describe, expect, it } from 'vitest'
import { AreaLoadError, areaFromSector } from './sector-area.ts'

const HALF = WALL_THICK / 2
const views = { a: { yawDeg: 0 }, b: { yawDeg: 90 } }

type Json = Record<string, unknown>
/** A rectangle sector from x0,z0 to x1,z1, walls as given by edge in order: south, east, north, west. */
const rect = (
  id: string,
  [x0, z0, x1, z1]: readonly [number, number, number, number],
  walls: readonly (Json | undefined)[] = [],
  more: Json = {},
): Json => ({
  id,
  floor: 0,
  ceiling: 3,
  light: 1,
  view: id,
  corners: [
    [x0, z0, walls[0]],
    [x1, z0, walls[1]],
    [x1, z1, walls[2]],
    [x0, z1, walls[3]],
  ].map((corner) => corner.filter((part) => part !== undefined)),
  ...more,
})
const spawn = { def: 'spawn', id: 'spawn', x: 1, z: 1 }
const goal = { def: 'goal', id: 'goal', x: 2, z: 2 }
const file = (sectors: Json[], entities: Json[] = [spawn, goal], more: Json = {}) => ({
  format: 'af-sector/2',
  name: 'test',
  views,
  sectors,
  entities,
  ...more,
})
const convert = (json: unknown) => areaFromSector(json, { file: 'test.af-sector.json' })
const failure = (json: unknown): AreaLoadError => {
  try {
    convert(json)
  } catch (error) {
    if (error instanceof AreaLoadError) return error
    throw error
  }
  throw new Error('expected the file to be refused')
}

describe('areaFromSector (GAME-3D.1i)', () => {
  it('turns a rectangle into a room box and four wall boxes WALL_THICK thick, closed at the corners', () => {
    const area = convert(file([rect('a', [0, 0, 4, 3])]))
    expect(area.id).toBe('test')
    expect(area.rooms).toEqual([{ view: 'a', min: [0, 0], max: [4, 3] }])
    expect(area.walls).toEqual(
      expect.arrayContaining([
        { min: [-HALF, -HALF], max: [4 + HALF, HALF] },
        { min: [4 - HALF, -HALF], max: [4 + HALF, 3 + HALF] },
        { min: [-HALF, 3 - HALF], max: [4 + HALF, 3 + HALF] },
        { min: [-HALF, -HALF], max: [HALF, 3 + HALF] },
      ]),
    )
    expect(area.walls).toHaveLength(4)
    expect(area.views).toEqual([
      { id: 'a', yawDeg: 0 },
      { id: 'b', yawDeg: 90 },
    ])
  })

  it('leaves a portal edge open, and a door’s opening open between two flanks', () => {
    const open = convert(
      file([
        rect('a', [0, 0, 4, 3], [undefined, { next: 'b' }]),
        rect('b', [4, 0, 8, 3], [undefined, undefined, undefined, { next: 'a' }]),
      ]),
    )
    expect(open.walls.some((wall) => wall.min[0] === 4 - HALF && wall.max[0] === 4 + HALF)).toBe(false)
    const door = { next: 'b', door: { at: 1.5, width: 2, height: 2.2 } }
    const doored = convert(
      file([
        rect('a', [0, 0, 4, 3], [undefined, door]),
        rect('b', [4, 0, 8, 3], [undefined, undefined, undefined, { ...door, next: 'a' }]),
      ]),
    )
    const east = doored.walls.filter((wall) => wall.min[0] === 4 - HALF && wall.max[0] === 4 + HALF)
    expect(east).toEqual([
      { min: [4 - HALF, -HALF], max: [4 + HALF, 0.5] },
      { min: [4 - HALF, 2.5], max: [4 + HALF, 3 + HALF] },
    ])
  })

  it('finds a door from the wall’s start as written, in a room whose corners run clockwise', () => {
    // The opening is z 1.75 to 2.75 on x = 4. Room `a` writes its east wall from (0,0) up to (4,3), the door 2.25 along;
    // the same room written clockwise starts that wall at (4,3), so the same opening is 0.75 along. Room `b` writes
    // the shared wall from (4,3) and keeps its door 0.75 along.
    const east = (at: number) => ({ next: 'b', door: { at, width: 1, height: 2.2 } })
    const west = { next: 'a', door: { at: 0.75, width: 1, height: 2.2 } }
    const b = rect('b', [4, 0, 8, 3], [undefined, undefined, undefined, west])
    const counterClockwise = rect('a', [0, 0, 4, 3], [undefined, east(2.25)])
    const clockwise = {
      ...rect('a', [0, 0, 4, 3]),
      corners: [[0, 0], [0, 3], [4, 3], [4, 0, east(0.75)].filter(Boolean)].map((corner) => corner),
    }
    // The wall from (4,3) to (4,0) is the third edge: its corner is (4,3).
    clockwise.corners = [
      [0, 0],
      [0, 3],
      [4, 3, east(0.75)],
      [4, 0],
    ]
    const key = (box: { min: number[]; max: number[] }) => JSON.stringify(box)
    const sorted = (area: ReturnType<typeof convert>) => area.walls.map(key).sort()
    expect(sorted(convert(file([clockwise, b])))).toEqual(sorted(convert(file([counterClockwise, b]))))
  })

  it('writes a wall shared by two rooms once', () => {
    const door = { next: 'b', door: { at: 1.5, width: 2, height: 2.2 } }
    const both = convert(
      file([
        rect('a', [0, 0, 4, 3], [undefined, door]),
        // The second room's west edge runs from the north end to the south end: its door is the same 2 m opening.
        rect('b', [4, 0, 8, 3], [undefined, undefined, undefined, { ...door, next: 'a' }]),
      ]),
    )
    const shared = both.walls.filter((wall) => wall.min[0] === 4 - HALF && wall.max[0] === 4 + HALF)
    expect(shared).toHaveLength(2)
  })

  it('makes a sector flagged as a pit a pit, with no room box; a low floor alone is a room', () => {
    const area = convert(
      file([rect('a', [0, 0, 4, 3]), rect('b', [4, 0, 6, 3], [], { floor: -3, pit: true, view: undefined })]),
    )
    expect(area.pits).toEqual([{ min: [4, 0], max: [6, 3] }])
    expect(area.rooms.map((room) => room.view)).toEqual(['a'])
    const sunken = convert(file([rect('a', [0, 0, 4, 3], [], { floor: { z: -3 } })]))
    expect(sunken.pits).toEqual([])
    expect(sunken.rooms).toHaveLength(1)
  })

  it('still reads an af-sector/1 file: its sectors migrate and a views member it carries is kept', () => {
    const old = convert({ ...file([rect('a', [0, 0, 4, 3])]), format: 'af-sector/1' })
    expect(old.rooms).toHaveLength(1)
    expect(old.views.map((view) => view.id)).toEqual(['a', 'b'])
  })

  it('reads the spawn, the embers and the goal', () => {
    const area = convert(
      file(
        [rect('a', [0, 0, 4, 3])],
        [spawn, goal, { def: 'ember', id: 'e1', x: 3, z: 2 }, { def: 'ember', id: 'e2', x: 1, z: 2 }],
      ),
    )
    expect(area.spawn).toEqual({ x: 1, z: 1 })
    expect(area.goal).toEqual({ x: 2, z: 2 })
    expect(area.embers).toEqual([
      { x: 3, z: 2 },
      { x: 1, z: 2 },
    ])
  })

  describe('a file it cannot read names the file and the JSON path (G3-F2)', () => {
    it('refuses a sector that is not an axis-aligned rectangle', () => {
      const triangle = {
        ...rect('a', [0, 0, 4, 3]),
        corners: [
          [0, 0],
          [4, 0],
          [2, 3],
        ],
      }
      const error = failure(file([rect('b', [0, 5, 2, 7]), triangle]))
      expect(error.path).toBe('sectors[1]')
      expect(error.message).toContain('test.af-sector.json')
      expect(error.message).toMatch(/axis-aligned rectangle/)
      const slanted = {
        ...rect('a', [0, 0, 4, 3]),
        corners: [
          [0, 0],
          [4, 1],
          [4, 3],
          [0, 3],
        ],
      }
      expect(failure(file([slanted])).path).toBe('sectors[0]')
    })

    it('refuses a sector with a hole, one without a view, and a view the area does not define', () => {
      expect(
        failure(
          file([
            rect('a', [0, 0, 4, 3], [], {
              holes: [
                [
                  [1, 1],
                  [2, 1],
                  [2, 2],
                ],
              ],
            }),
          ]),
        ).path,
      ).toBe('sectors[0].holes')
      expect(failure(file([rect('a', [0, 0, 4, 3], [], { view: undefined })])).path).toBe('sectors[0].view')
      expect(failure(file([rect('a', [0, 0, 4, 3], [], { view: 'nowhere' })])).path).toBe('sectors[0].view')
    })

    it('refuses an unknown entity, a missing or doubled spawn, and a missing goal', () => {
      expect(
        failure(file([rect('a', [0, 0, 4, 3])], [spawn, goal, { def: 'tree', id: 't', x: 0, z: 0 }])).path,
      ).toBe('entities[2].def')
      expect(failure(file([rect('a', [0, 0, 4, 3])], [goal])).path).toBe('entities')
      expect(failure(file([rect('a', [0, 0, 4, 3])], [spawn, spawn, goal])).path).toBe('entities[1]')
      expect(failure(file([rect('a', [0, 0, 4, 3])], [spawn])).path).toBe('entities')
    })

    it('refuses a file the af-sector schema refuses, at the schema’s path', () => {
      expect(failure({ ...file([rect('a', [0, 0, 4, 3])]), format: 'af-sector/9' }).path).toBe('format')
      expect(failure({ format: 'af-sector/2', name: 'x', sectors: [{ id: 'a' }] }).path).toBe(
        'sectors[0].floor',
      )
    })
  })
})

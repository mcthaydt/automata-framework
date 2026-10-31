// The level converter (GAME-3D.1i, DESIGN.md §17): an `af-sector/1` file read as an `AreaSource`. Rectangular sectors
// only in 1.0; a file that cannot be read fails naming the file and the JSON path (G3-F2).
import { WALL_THICK } from '@mcthaydt/automata-sector-format'
import { describe, expect, it } from 'vitest'
import { AreaLoadError } from '../../systems/index.ts'
import { areaFromSector } from './sector-area.ts'

const HALF = WALL_THICK / 2
const views = [{ id: 'a' }, { id: 'b' }]

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
const ember = { def: 'ember', id: 'ember', x: 2, z: 2 }
const file = (sectors: Json[], entities: Json[] = [spawn, ember], more: Json = {}) => ({
  format: 'af-sector/1',
  name: 'test',
  sectors,
  entities,
  ...more,
})
const convert = (json: unknown) => areaFromSector(json, { file: 'test.af-sector.json', views })
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
    expect(area.views).toEqual(views)
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

  it('makes a sector below the floor a pit, with no room box', () => {
    const area = convert(
      file([rect('a', [0, 0, 4, 3]), rect('b', [4, 0, 6, 3], [], { floor: -3, view: undefined })]),
    )
    expect(area.pits).toEqual([{ min: [4, 0], max: [6, 3] }])
    expect(area.rooms.map((room) => room.view)).toEqual(['a'])
  })

  it('reads the spawn, the ember, the exits and the foes; the other entities are the dungeon’s pieces', () => {
    const area = convert(
      file(
        [rect('a', [0, 0, 4, 3])],
        [
          spawn,
          ember,
          { def: 'foe', id: 'f1', x: 3, z: 2, kind: 'sootling', facing: 90 },
          {
            def: 'area-exit',
            id: 'out',
            x: 3.5,
            z: 1.5,
            width: 1,
            depth: 2,
            to: 'next',
            entryX: 7,
            entryZ: 8,
          },
          { def: 'chest', id: 'c', x: 1, z: 2, contents: 'map' },
        ],
      ),
    )
    expect(area.spawn).toEqual({ x: 1, z: 1 })
    expect(area.ember).toEqual({ x: 2, z: 2 })
    expect(area.foes).toEqual([{ kind: 'sootling', x: 3, z: 2, facing: 90 }])
    expect(area.exits).toEqual([{ min: [3, 0.5], max: [4, 2.5], to: 'next', entry: { x: 7, z: 8 } }])
    expect(area.entities).toEqual([{ def: 'chest', id: 'c', x: 1, z: 2, contents: 'map' }])
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

    it('refuses an unknown entity, a missing or doubled spawn, and a missing ember', () => {
      expect(
        failure(file([rect('a', [0, 0, 4, 3])], [spawn, ember, { def: 'tree', id: 't', x: 0, z: 0 }])).path,
      ).toBe('entities[2].def')
      expect(failure(file([rect('a', [0, 0, 4, 3])], [ember])).path).toBe('entities')
      expect(failure(file([rect('a', [0, 0, 4, 3])], [spawn, spawn, ember])).path).toBe('entities[1]')
      expect(failure(file([rect('a', [0, 0, 4, 3])], [spawn])).path).toBe('entities')
    })

    it('refuses a file the af-sector schema refuses, at the schema’s path', () => {
      expect(failure({ ...file([rect('a', [0, 0, 4, 3])]), format: 'af-sector/9' }).path).toBe('format')
      expect(failure({ format: 'af-sector/1', name: 'x', sectors: [{ id: 'a' }] }).path).toBe(
        'sectors[0].floor',
      )
    })
  })
})

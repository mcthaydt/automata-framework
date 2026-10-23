// Where an expanded wall is in the document. `expand` splits a wall where an opening cuts it, adds a connector sector,
// and a pilaster adds walls of its own, so an expanded edge is not always a corner of the file: the locator names the
// corner a wall came from, and a sector for a wall that came from none (never a wrong corner).
import { describe, expect, it } from 'vitest'
import type { Blockout } from '../../format/blockout.schema'
import { expand } from '../../format/expand'
import { resolveMap } from '../../geometry/sectors'
import { loadFixture } from '../../testing/fixtures'
import { BLOCKOUT_NAMES } from '../../testing/geometry-golden'
import { must, toyBlockout, toyRoom } from '../../testing/toy-blockout'
import { wallLocator } from './wall-locator'

const resolve = (blockout: Blockout) => {
  const expanded = expand(blockout)
  return resolveMap(expanded.sectors, expanded.masses)
}
const locatorsOf = (blockout: Blockout, sector: string) => {
  const locate = wallLocator(blockout)
  return resolve(blockout)
    .edges.filter((edge) => edge.sector.id === sector)
    .map((edge) => locate(edge))
}
const square = (x0: number, z0: number, x1: number, z1: number) =>
  [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ] as const

describe('wallLocator', () => {
  it("gives a plain wall its corner, at the wall's start, and a wall an opening split the corner it came from", () => {
    expect(locatorsOf(toyBlockout(), 'a')).toEqual([
      { selection: 'wall:a/0', at: { x: 0, z: 0 } },
      { selection: 'wall:a/1', at: { x: 4, z: 0 } },
      { selection: 'wall:a/1', at: { x: 4, z: 1.5 } },
      { selection: 'wall:a/1', at: { x: 4, z: 2.5 } },
      { selection: 'wall:a/2', at: { x: 4, z: 4 } },
      { selection: 'wall:a/3', at: { x: 0, z: 4 } },
    ])
    expect(locatorsOf(toyBlockout(), 'b').map((locator) => locator?.selection)).toEqual([
      'wall:b/0',
      'wall:b/1',
      'wall:b/2',
      'wall:b/3',
      'wall:b/3',
      'wall:b/3',
    ])
  })

  it("gives a connector's walls the connector, at the middle of the wall", () => {
    expect(locatorsOf(toyBlockout(), 'ab')).toEqual([
      { selection: 'sector:ab', at: { x: 4.0625, z: 1.5 } },
      { selection: 'sector:ab', at: { x: 4.125, z: 2 } },
      { selection: 'sector:ab', at: { x: 4.0625, z: 2.5 } },
      { selection: 'sector:ab', at: { x: 4, z: 2 } },
    ])
  })

  it('numbers the corners as the file does, whichever way the room is wound', () => {
    const clockwise = toyBlockout({
      rooms: [
        {
          ...toyRoom('a'),
          corners: [
            [0, 0],
            [0, 4],
            [4, 4],
            [4, 0],
          ],
        },
      ],
      openings: [],
      boxes: [],
    })
    // The resolved loop runs the other way round; the corners are still the file's: 0→1 is the west wall, and so on.
    const found = locatorsOf(clockwise, 'a').map((locator) => locator?.selection)
    expect(found.sort()).toEqual(['wall:a/0', 'wall:a/1', 'wall:a/2', 'wall:a/3'])
    const west = resolve(clockwise).edges.find((edge) => edge.a.x === 0 && edge.b.x === 0)
    expect(wallLocator(clockwise)(must(west))?.selection).toBe('wall:a/0')
    const north = resolve(clockwise).edges.find((edge) => edge.a.z === 4 && edge.b.z === 4)
    expect(wallLocator(clockwise)(must(north))?.selection).toBe('wall:a/1')
  })

  it("gives a pilaster's notch walls the sector, even where one lies on a neighbouring wall", () => {
    const pilastered = toyBlockout({
      rooms: [
        {
          ...toyRoom('a'),
          corners: [
            [0, 0, { cut: 'south', pilaster: { start: [0.5, 0.25] } }],
            [4, 0],
            [4, 4],
            [0, 4],
          ],
        },
      ],
      openings: [],
      boxes: [],
    })
    const locate = wallLocator(pilastered)
    const edges = resolve(pilastered).edges
    // The first notch wall runs (0,0)→(0,0.25): on the west wall's line, which is corner 3's.
    expect(edges[0]?.notch).toBe(true)
    expect(locate(must(edges[0]))).toEqual({ selection: 'sector:a', at: { x: 0, z: 0.125 } })
    // Its stretch of plain wall past the pilaster is still corner 0's.
    expect(edges[3]?.notch).toBe(false)
    expect(locate(must(edges[3]))).toEqual({ selection: 'wall:a/0', at: { x: 0.5, z: 0 } })
  })

  it("gives a hole's walls the sector: the holes' corners have no place in a wall id", () => {
    const holed = toyBlockout({
      rooms: [
        {
          ...toyRoom('a'),
          holes: [
            [
              [1, 1],
              [3, 1],
              [3, 3],
              [1, 3],
            ],
          ],
        },
      ],
      openings: [],
      boxes: [],
    })
    const found = locatorsOf(holed, 'a')
    expect(found.slice(0, 4).map((locator) => locator?.selection)).toEqual([
      'wall:a/0',
      'wall:a/1',
      'wall:a/2',
      'wall:a/3',
    ])
    expect(found.slice(4).map((locator) => locator?.selection)).toEqual(Array(4).fill('sector:a'))
  })

  it("gives a hole's wall the sector even where it lies on the room's own outer wall", () => {
    const touching = toyBlockout({
      rooms: [
        {
          ...toyRoom('a'),
          holes: [
            [
              [3, 1],
              [4, 1],
              [4, 3],
              [3, 3],
            ],
          ],
        },
      ],
      openings: [],
      boxes: [],
    })
    const holeWalls = locatorsOf(touching, 'a').slice(4)
    expect(holeWalls.map((locator) => locator?.selection)).toEqual(Array(4).fill('sector:a'))
  })

  it('finds a wall on the first room of an id, and gives the walls of a second room of that id its sector', () => {
    const twice = toyBlockout({
      rooms: [
        toyRoom('a'),
        {
          ...toyRoom('a'),
          corners: [
            [10, 0],
            [14, 0],
            [14, 4],
            [10, 4],
          ],
        },
      ],
      openings: [],
      boxes: [],
    })
    expect(locatorsOf(twice, 'a').map((locator) => locator?.selection)).toEqual([
      'wall:a/0',
      'wall:a/1',
      'wall:a/2',
      'wall:a/3',
      ...Array(4).fill('sector:a'),
    ])
  })

  it('says nothing for a room whose id cannot be in a selection id', () => {
    const odd = toyBlockout({
      rooms: [{ ...toyRoom('a'), id: 'a/b', corners: [...square(0, 0, 4, 4)] }],
      openings: [],
      boxes: [],
    })
    expect(locatorsOf(odd, 'a/b')).toEqual([undefined, undefined, undefined, undefined])
  })

  it('names the wall from a room that is not in the file (the map came from elsewhere) by its sector', () => {
    const locate = wallLocator(toyBlockout({ rooms: [toyRoom('a')], openings: [], boxes: [] }))
    const other = resolve(toyBlockout()).edges.find((edge) => edge.sector.id === 'b')
    expect(locate(must(other))?.selection).toBe('sector:b')
  })

  for (const name of BLOCKOUT_NAMES) {
    it(`${name}: every wall of every room that is not a pilaster's or a hole's is a wall of the file, and lies on it`, () => {
      const blockout = JSON.parse(loadFixture(name)) as Blockout
      const expanded = expand(blockout)
      const map = resolveMap(expanded.sectors, expanded.masses)
      const locate = wallLocator(blockout)
      let walls = 0
      for (const edge of map.edges) {
        const room = blockout.rooms.find((candidate) => candidate.id === edge.sector.id)
        const found = locate(edge)
        if (!room || edge.loop > 0 || edge.notch) {
          expect(found?.selection, `${edge.sector.id}:${edge.index}`).toBe(`sector:${edge.sector.id}`)
          continue
        }
        walls++
        const [, ref] = (found?.selection ?? '').split(':')
        const corner = Number((ref ?? '').split('/')[1])
        expect(found?.selection, `${edge.sector.id}:${edge.index}`).toBe(`wall:${room.id}/${corner}`)
        const from = room.corners[corner] as readonly number[]
        const to = room.corners[(corner + 1) % room.corners.length] as readonly number[]
        const [mx, mz] = [(edge.a.x + edge.b.x) / 2, (edge.a.z + edge.b.z) / 2]
        const [dx, dz] = [(to[0] as number) - (from[0] as number), (to[1] as number) - (from[1] as number)]
        const length = Math.hypot(dx, dz)
        const side = Math.abs((mx - (from[0] as number)) * dz - (mz - (from[1] as number)) * dx) / length
        expect(side, `${edge.sector.id}:${edge.index} is on corner ${corner}'s wall`).toBeLessThan(1e-6)
      }
      expect(walls).toBeGreaterThan(0)
    })
  }
})

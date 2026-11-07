// Where a resolved wall is in the document. A wall of a sector's outline lies on one of its corners' segments: the
// locator names that corner, as the file numbers it. A wall that came from none (a hole's) is the sector's: the locator
// names the sector, never a wrong corner.

import type { AfSector, AfSectorEntry } from '@automata/3d/level'
import { describe, expect, it } from 'vitest'
import { resolveMap } from '../geometry/sectors'
import { buildSectors } from '../profile/af-sector/build'
import { afSectorProfile } from '../profile/af-sector-profile'
import { must } from '../testing/edit-helpers'
import { loadAuthored } from '../testing/fixtures'
import { toyAfSector } from '../testing/toy-af-sector'
import { wallLocator } from './wall-locator'

const room = (
  id: string,
  corners: AfSectorEntry['corners'],
  more: Partial<AfSectorEntry> = {},
): AfSectorEntry => ({
  id,
  floor: 0,
  ceiling: 4,
  light: 1,
  corners,
  ...more,
})
const square = (x0: number, z0: number, x1: number, z1: number) =>
  [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ] as const
const hole = (x0: number, z0: number, x1: number, z1: number) => [...square(x0, z0, x1, z1)]

const resolve = (level: AfSector) => resolveMap(buildSectors(level))
const locatorsOf = (level: AfSector, sector: string) => {
  const locate = wallLocator(level.sectors)
  return resolve(level)
    .edges.filter((edge) => edge.sector.id === sector)
    .map((edge) => locate(edge))
}
const levelOf = (...sectors: AfSectorEntry[]) => toyAfSector({ sectors })

describe('wallLocator', () => {
  it("gives a wall its corner, at the wall's start", () => {
    expect(locatorsOf(levelOf(room('a', square(0, 0, 4, 4))), 'a')).toEqual([
      { selection: 'wall:a/0', at: { x: 0, z: 0 } },
      { selection: 'wall:a/1', at: { x: 4, z: 0 } },
      { selection: 'wall:a/2', at: { x: 4, z: 4 } },
      { selection: 'wall:a/3', at: { x: 0, z: 4 } },
    ])
  })

  it('numbers the corners as the file does, whichever way the room is wound', () => {
    const clockwise = levelOf(
      room('a', [
        [0, 0],
        [0, 4],
        [4, 4],
        [4, 0],
      ]),
    )
    // The resolved loop may run the other way round; the corners are still the file's: 0→1 is the west wall, and so on.
    const found = locatorsOf(clockwise, 'a').map((locator) => locator?.selection)
    expect(found.sort()).toEqual(['wall:a/0', 'wall:a/1', 'wall:a/2', 'wall:a/3'])
    const locate = wallLocator(clockwise.sectors)
    const west = resolve(clockwise).edges.find((edge) => edge.a.x === 0 && edge.b.x === 0)
    expect(locate(must(west))?.selection).toBe('wall:a/0')
    const north = resolve(clockwise).edges.find((edge) => edge.a.z === 4 && edge.b.z === 4)
    expect(locate(must(north))?.selection).toBe('wall:a/1')
  })

  it("gives a hole's walls the sector: the holes' corners have no place in a wall id", () => {
    const found = locatorsOf(levelOf(room('a', square(0, 0, 4, 4), { holes: [hole(1, 1, 3, 3)] })), 'a')
    expect(found.slice(0, 4).map((locator) => locator?.selection)).toEqual([
      'wall:a/0',
      'wall:a/1',
      'wall:a/2',
      'wall:a/3',
    ])
    expect(found.slice(4).map((locator) => locator?.selection)).toEqual(Array(4).fill('sector:a'))
  })

  it("gives a hole's wall the sector even where it lies on the room's own outer wall", () => {
    const touching = levelOf(room('a', square(0, 0, 4, 4), { holes: [hole(3, 1, 4, 3)] }))
    const holeWalls = locatorsOf(touching, 'a').slice(4)
    expect(holeWalls.map((locator) => locator?.selection)).toEqual(Array(4).fill('sector:a'))
  })

  it('finds a wall on the first room of an id, and gives the walls of a second room of that id its sector', () => {
    const twice = levelOf(room('a', square(0, 0, 4, 4)), room('a', square(10, 0, 14, 4)))
    expect(locatorsOf(twice, 'a').map((locator) => locator?.selection)).toEqual([
      'wall:a/0',
      'wall:a/1',
      'wall:a/2',
      'wall:a/3',
      ...Array(4).fill('sector:a'),
    ])
  })

  it('says nothing for a room whose id cannot be in a selection id', () => {
    expect(locatorsOf(levelOf(room('a/b', square(0, 0, 4, 4))), 'a/b')).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ])
  })

  it('names the wall from a room that is not in the file (the map came from elsewhere) by its sector', () => {
    const level = toyAfSector()
    const locate = wallLocator([must(level.sectors[0])])
    const other = resolve(level).edges.find((edge) => edge.sector.id === 'dock')
    expect(locate(must(other))?.selection).toBe('sector:dock')
  })

  it('finds every wall of the depot on the corner of the file it lies on', () => {
    const parsed = afSectorProfile.parse(loadAuthored('depot.af-sector'))
    if (!parsed.ok) throw new Error('the depot does not parse')
    const level = parsed.value
    const locate = wallLocator(level.sectors)
    const map = resolve(level)
    for (const edge of map.edges) {
      const entry = must(level.sectors.find((candidate) => candidate.id === edge.sector.id))
      const found = locate(edge)
      const corner = Number((found?.selection ?? '').split('/')[1])
      expect(found?.selection, `${edge.sector.id}:${edge.index}`).toBe(`wall:${entry.id}/${corner}`)
      const from = must(entry.corners[corner])
      const to = must(entry.corners[(corner + 1) % entry.corners.length])
      const [mx, mz] = [(edge.a.x + edge.b.x) / 2, (edge.a.z + edge.b.z) / 2]
      const [dx, dz] = [to[0] - from[0], to[1] - from[1]]
      const side = Math.abs((mx - from[0]) * dz - (mz - from[1]) * dx) / Math.hypot(dx, dz)
      expect(side, `${edge.sector.id}:${edge.index} is on corner ${corner}'s wall`).toBeLessThan(1e-6)
    }
    expect(map.edges.length).toBeGreaterThan(0)
  })
})

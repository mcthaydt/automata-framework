// The world builder: a `/2` level into renderer-free pieces (spec 9), and the faults it reports instead of throwing.
import { describe, expect, it } from 'vitest'
import { buildWorld, type WorldPiece } from '#src/features/world/build.ts'
import type { WorldLibrary } from '#src/features/world/swatches.ts'
import type { AfCorner2, AfSector2, AfSectorEntry2, AfWall2 } from '#src/shared/level/af-sector-2.schema.ts'

const NAMES = [
  'oakFloor',
  'plasterWarm',
  'trimWhite',
  'doorWood',
  'brass',
  'glassDay',
  'glassNight',
  'windowLit',
  'windowDark',
  'brick',
  'paint',
  'cornice',
  'rug',
  'curtainLit',
  'blindsLit',
  'silhouette',
  'bulbWarm',
  'awningRed',
]
const LIB: WorldLibrary = { swatches: Object.fromEntries(NAMES.map((n) => [n, {}])) }

type Rect = [number, number, number, number]
const room = (
  id: string,
  [x0, z0, x1, z1]: Rect,
  extra: Partial<AfSectorEntry2> = {},
  walls: (AfWall2 | undefined)[] = [],
): AfSectorEntry2 => ({
  id,
  floor: { z: 0 },
  ceiling: { z: 3 },
  light: 1,
  corners: [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ].map(([x, z], i) => (walls[i] === undefined ? [x, z] : [x, z, walls[i]])) as AfCorner2[],
  ...extra,
})
const level = (...sectors: AfSectorEntry2[]): AfSector2 => ({ format: 'af-sector/2', name: 't', sectors })
const of = (pieces: WorldPiece[], part: WorldPiece['part'], sector?: string) =>
  pieces.filter((p) => p.part === part && (sector === undefined || p.sector === sector))
const ys = (p: WorldPiece): number[] => p.mesh.positions.filter((_, i) => i % 3 === 1)
const role = (p: WorldPiece): string => p.id.split(':')[1]!
const top = (p: WorldPiece): number => Math.max(...ys(p))
const bottom = (p: WorldPiece): number => Math.min(...ys(p))

describe('one room', () => {
  const { pieces, problems } = buildWorld(level(room('a', [0, 0, 4, 4])), LIB)
  it('has a floor, a ceiling and four walls, and nothing wrong with it', () => {
    expect(problems).toEqual([])
    expect(of(pieces, 'floor')).toHaveLength(1)
    expect(of(pieces, 'ceiling')).toHaveLength(1)
    expect(of(pieces, 'wall')).toHaveLength(4)
  })
  it('gives every piece its own id, the room first', () => {
    const ids = pieces.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((id) => id.startsWith('a:'))).toBe(true)
  })
  it('puts the floor at 0 and the ceiling at 3, the floor facing up and the ceiling down', () => {
    const [floor] = of(pieces, 'floor') as [WorldPiece]
    const [ceiling] = of(pieces, 'ceiling') as [WorldPiece]
    expect([bottom(floor), top(floor)]).toEqual([0, 0])
    expect([bottom(ceiling), top(ceiling)]).toEqual([3, 3])
    expect(floor.mesh.normals[1]).toBeCloseTo(1)
    expect(ceiling.mesh.normals[1]).toBeCloseTo(-1)
  })
  it('stands its walls from the floor to the ceiling, facing into the room', () => {
    for (const wall of of(pieces, 'wall')) {
      expect([bottom(wall), top(wall)]).toEqual([0, 3])
      // The room’s centre is (2, 4/2); the wall’s normal points toward it from its middle.
      const n = wall.mesh.normals
      const mx =
        wall.mesh.positions.filter((_, i) => i % 3 === 0).reduce((a, b) => a + b, 0) /
        (wall.mesh.positions.length / 3)
      const mz =
        wall.mesh.positions.filter((_, i) => i % 3 === 2).reduce((a, b) => a + b, 0) /
        (wall.mesh.positions.length / 3)
      expect(n[0]! * (2 - mx) + n[2]! * (2 - mz)).toBeGreaterThan(0)
    }
  })
  it('is deterministic', () =>
    expect(buildWorld(level(room('a', [0, 0, 4, 4])), LIB)).toEqual({ pieces, lamps: [], problems }))
})

describe('faults', () => {
  it('reports a degenerate room instead of throwing', () => {
    const lv = level(room('room-1', [0, 0, 4, 4]), room('room-2', [10, 0, 14, 0]))
    const { pieces, problems } = buildWorld(lv, LIB)
    expect(problems).toContainEqual(
      expect.objectContaining({ code: 'degenerate-sector', where: 'room-2', path: ['sectors', 1] }),
    )
    expect(pieces.every((p) => p.sector !== 'room-2')).toBe(true)
    expect(of(pieces, 'floor', 'room-1')).toHaveLength(1)
  })
  it('reports a swatch the library lacks, once, and still draws the room', () => {
    const lv = level(room('a', [0, 0, 4, 4], { floor: { z: 0, surface: 'nope' } }))
    const { pieces, problems } = buildWorld(lv, LIB)
    expect(problems).toEqual([expect.objectContaining({ code: 'unknown-swatch', where: 'a', name: 'nope' })])
    expect(of(pieces, 'floor')).toHaveLength(1)
  })
  it('reads a seeded swatch name as its base', () => {
    const lv = level(room('a', [0, 0, 4, 4], { floor: { z: 0, surface: 'rug#12' } }))
    expect(buildWorld(lv, LIB).problems).toEqual([])
  })
  it('reports a portal to a room that does not share the wall, and keeps the wall solid', () => {
    const lv = level(
      room('a', [0, 0, 4, 4], {}, [undefined, undefined, undefined, { next: 'b' }]),
      room('b', [10, 0, 14, 4]),
    )
    const { pieces, problems } = buildWorld(lv, LIB)
    expect(problems).toContainEqual(
      expect.objectContaining({ code: 'portal-not-shared', where: 'a', name: 'b' }),
    )
    expect(of(pieces, 'wall', 'a')).toHaveLength(4)
  })
  it('reports a portal to a room that is not in the level', () => {
    const lv = level(room('a', [0, 0, 4, 4], {}, [{ next: 'ghost' }]))
    expect(buildWorld(lv, LIB).problems).toContainEqual(
      expect.objectContaining({ code: 'portal-not-shared', name: 'ghost' }),
    )
  })
})

describe('planes', () => {
  it('tilts a sloped floor along its slope', () => {
    const { pieces } = buildWorld(level(room('a', [0, 0, 4, 4], { floor: { z: 0, slope: [0.1, 0] } })), LIB)
    const floor = of(pieces, 'floor')[0] as WorldPiece
    const p = floor.mesh.positions
    for (let i = 0; i < p.length; i += 3) expect(p[i + 1]).toBeCloseTo(0.1 * (p[i]! - 0))
    expect(floor.mesh.normals[0]).toBeLessThan(0)
  })
  it('has no ceiling piece under open sky', () => {
    const { pieces } = buildWorld(level(room('yard', [0, 0, 4, 4], { ceiling: { z: 3, sky: true } })), LIB)
    expect(of(pieces, 'ceiling')).toHaveLength(0)
  })
  it('puts a surface on the plane and carries its placement', () => {
    const { pieces } = buildWorld(
      level(room('a', [0, 0, 4, 4], { floor: { z: 0, surface: { tile: 'rug', repeat: [2, 2] } } })),
      LIB,
    )
    const floor = of(pieces, 'floor')[0] as WorldPiece
    expect(floor.surface).toEqual({ tile: 'rug', repeat: [2, 2] })
    expect(floor.tex).toEqual({ repeat: [2, 2] })
  })
  it('reads the sector’s old texture fields when the plane names no surface', () => {
    const { pieces } = buildWorld(
      level(room('a', [0, 0, 4, 4], { floorTexture: 'rug', wallTexture: 'paint' })),
      LIB,
    )
    expect(of(pieces, 'floor')[0]!.surface).toBe('rug')
    expect(of(pieces, 'wall')[0]!.surface).toBe('paint')
  })
})

describe('walls', () => {
  it('leaves an open edge out', () => {
    const { pieces } = buildWorld(level(room('a', [0, 0, 4, 4], {}, [{ none: true }])), LIB)
    expect(of(pieces, 'wall')).toHaveLength(3)
  })
  it('cuts a doorway out of a solid wall and leaves a lintel over it', () => {
    const { pieces } = buildWorld(
      level(room('a', [0, 0, 6, 4], {}, [{ door: { at: 3, width: 1, height: 2 } }])),
      LIB,
    )
    const wall = of(pieces, 'wall').find((p) => p.id.startsWith('a:wall:0.0'))!
    // No vertex of the face sits inside the opening (x in 2.5…3.5, y under 2) except along its edges.
    const p = wall.mesh.positions
    const covered = []
    for (let i = 0; i < wall.mesh.indices.length; i += 3) {
      const [a, b, c] = [0, 1, 2].map((k) => wall.mesh.indices[i + k]! * 3)
      const cx = (p[a!]! + p[b!]! + p[c!]!) / 3
      const cy = (p[a! + 1]! + p[b! + 1]! + p[c! + 1]!) / 3
      if (cx > 2.55 && cx < 3.45 && cy < 1.95) covered.push(i)
    }
    expect(covered).toEqual([])
    expect(top(wall)).toBe(3)
    expect(p.some((v, i) => i % 3 === 1 && Math.abs(v - 2) < 1e-9)).toBe(true)
  })
  it('lays skirting, a rail, a dado and a cornice as pieces of their own', () => {
    const wall: AfWall2 = {
      skirting: 0.1,
      rail: 0.9,
      dado: { surface: 'brick', height: 1 },
      cornice: { surface: 'cornice', height: 0.2 },
    }
    const { pieces, problems } = buildWorld(level(room('a', [0, 0, 4, 4], {}, [wall])), LIB)
    expect(problems).toEqual([])
    const roles = of(pieces, 'wall').map((p) => p.id.split(':')[1])
    expect(roles).toEqual(expect.arrayContaining(['skirting', 'rail', 'dado', 'cornice']))
  })
  it('breaks the skirting at a door', () => {
    const plain = buildWorld(level(room('a', [0, 0, 6, 4], {}, [{ skirting: 0.1 }])), LIB).pieces
    const broken = buildWorld(
      level(room('a', [0, 0, 6, 4], {}, [{ skirting: 0.1, door: { at: 3, width: 1, height: 2 } }])),
      LIB,
    ).pieces
    const skirt = (ps: WorldPiece[]) => ps.find((p) => role(p) === 'skirting')!.mesh.positions.length
    expect(skirt(broken)).toBeGreaterThan(skirt(plain)) // two runs, not one
  })
})

describe('portals', () => {
  const two = (b: Partial<AfSectorEntry2>, a: Partial<AfSectorEntry2> = {}) =>
    buildWorld(level(room('a', [0, 0, 4, 4], a), room('b', [4, 0, 8, 4], b)), LIB).pieces
  it('opens the shared stretch: no wall between rooms at the same height', () => {
    const pieces = two({})
    expect(of(pieces, 'wall', 'a')).toHaveLength(3)
    expect(of(pieces, 'wall', 'b')).toHaveLength(3)
  })
  it('steps up to a higher neighbour floor: a lower strip from this floor to that one', () => {
    const pieces = two({ floor: { z: 0.5 } })
    const lower = of(pieces, 'wall', 'a').find((p) => role(p) === 'lower')!
    expect([bottom(lower), top(lower)]).toEqual([0, 0.5])
    expect(of(pieces, 'wall', 'b').some((p) => role(p) === 'lower')).toBe(false)
  })
  it('hangs an upper strip under a lower neighbour ceiling', () => {
    const pieces = two({ ceiling: { z: 2.2 } })
    const upper = of(pieces, 'wall', 'a').find((p) => role(p) === 'upper')!
    expect([bottom(upper), top(upper)]).toEqual([2.2, 3])
  })
  it('leaves no upper strip between two open skies', () => {
    const sky = { ceiling: { z: 3, sky: true } }
    const pieces = two({ ...sky, ceiling: { z: 2, sky: true } }, sky)
    expect(pieces.some((p) => role(p) === 'upper')).toBe(false)
  })
  it('takes the neighbour’s surface from the wall’s lower and upper fields', () => {
    const pieces = buildWorld(
      level(
        room('a', [0, 0, 4, 4], {}, [undefined, { lower: 'brick' }]),
        room('b', [4, 0, 8, 4], { floor: { z: 1 } }),
      ),
      LIB,
    ).pieces
    expect(of(pieces, 'wall', 'a').find((p) => role(p) === 'lower')!.surface).toBe('brick')
  })
  it('accepts a portal the wall names, and a pit below its neighbours shows its wall from inside', () => {
    const lv = level(
      room('a', [0, 0, 4, 4], {}, [undefined, { next: 'pit' }]),
      room('pit', [4, 0, 8, 4], { floor: { z: -3 }, pit: true }),
    )
    const { pieces, problems } = buildWorld(lv, LIB)
    expect(problems).toEqual([])
    const lower = of(pieces, 'wall', 'pit').find((p) => role(p) === 'lower')!
    expect([bottom(lower), top(lower)]).toEqual([-3, 0])
    expect(of(pieces, 'floor', 'pit')).toHaveLength(1)
  })
})

describe('holes', () => {
  it('walls a hole from the room side and leaves it out of the floor', () => {
    const lv = level(
      room('a', [0, 0, 6, 6], {
        holes: [
          [
            [2, 2],
            [4, 2],
            [4, 4],
            [2, 4],
          ],
        ],
      }),
    )
    const { pieces, problems } = buildWorld(lv, LIB)
    expect(problems).toEqual([])
    expect(of(pieces, 'wall')).toHaveLength(8)
    const floor = of(pieces, 'floor')[0] as WorldPiece
    const p = floor.mesh.positions
    let area = 0
    for (let i = 0; i < floor.mesh.indices.length; i += 3) {
      const [a, b, c] = [0, 1, 2].map((k) => floor.mesh.indices[i + k]! * 3) as [number, number, number]
      area +=
        Math.abs((p[b]! - p[a]!) * (p[c + 2]! - p[a + 2]!) - (p[b + 2]! - p[a + 2]!) * (p[c]! - p[a]!)) / 2
    }
    expect(area).toBeCloseTo(32)
  })
})

describe('doors and decor', () => {
  it('hangs a hinged door in a doorway sector, shut, with the hinge it swings on', () => {
    const lv = level(
      room('a', [0, 0, 4, 4]),
      room('doorway', [4, 1.5, 4.2, 2.5], { door: { hinge: 'start', into: -1 } }),
      room('b', [4.2, 0, 8, 4]),
    )
    const { pieces } = buildWorld(lv, LIB)
    const doors = of(pieces, 'decor', 'doorway').filter((p) => p.door !== undefined)
    expect(doors.length).toBeGreaterThan(0)
    for (const d of doors) expect(d.door!.hinge).toEqual(doors[0]!.door!.hinge)
    expect(Math.abs(doors[0]!.door!.swing)).toBe(88)
  })
  it('builds a window on a wall: glass, frame, bars and sill', () => {
    const wall: AfWall2 = { decor: [{ kind: 'window', pos: 2, width: 1, height: 1.2 }] }
    const { pieces, problems } = buildWorld(level(room('a', [0, 0, 4, 4], {}, [wall])), LIB)
    expect(problems).toEqual([])
    const roles = of(pieces, 'decor').map((p) => role(p))
    expect(roles).toEqual(expect.arrayContaining(['glass', 'frame', 'bars', 'sill']))
  })
  it('lights a window at night and darkens it by day', () => {
    const wall: AfWall2 = { decor: [{ kind: 'window', pos: 2, width: 1 }] }
    const lv = level(room('a', [0, 0, 4, 4], {}, [wall]))
    const glass = (night: boolean) =>
      of(buildWorld(lv, LIB, { night }).pieces, 'decor').find((p) => role(p) === 'glass')!.surface
    expect(glass(true)).toBe('windowLit')
    expect(glass(false)).toBe('glassDay')
  })
  it('lays a grid of windows over a facade, a seeded share lit', () => {
    const wall: AfWall2 = {
      windows: { from: 1, rows: 2, cols: 3, width: 0.8, height: 1, gap: 0.3, lit: 0.5, seed: 4 },
    }
    const lv = level(room('a', [0, 0, 12, 4], {}, [wall]))
    const a = buildWorld(lv, LIB, { night: true })
    expect(of(a.pieces, 'decor').filter((p) => role(p) === 'glass')).toHaveLength(6)
    expect(buildWorld(lv, LIB, { night: true })).toEqual(a)
  })
})

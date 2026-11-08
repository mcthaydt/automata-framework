// The blockout the 3D views draw (ED3D.4 step 6, ED3D spec §5.4): a level's sectors as flat surfaces, each with the
// selection id the app selects it by, a unit normal and a shade. The rooms are 8 m by 6 m and 4 m high unless a test says
// otherwise; `z` is the plan's `z`, so a wall's coordinates read the same here as on the plan.

import type { AfSector2File, AfSectorEntry2File, AfWall2 } from '@automata/3d/level'
import { polygonArea } from '@automata/3d/level'
import { describe, expect, it } from 'vitest'
import { planScene } from '#src/features/levels-3d/plan/plan-scene.ts'
import { selectionOf } from '#src/shared/edit/selection-of.ts'
import {
  buildSectorMesh,
  EMPTY_BOUNDS,
  faceShade,
  type SectorMesh,
  type Surface,
  type SurfaceRole,
  type Vec3,
} from '#src/shared/geometry/sector-mesh.ts'
import { afSectorProfile } from '#src/shared/level-session/af-sector-profile.ts'
import { loadAuthored } from '#src/testing/fixtures.ts'
import { toyAfSector, toyDock, toyHall } from '#src/testing/toy-af-sector.ts'

const meshOf = (level: AfSector2File): SectorMesh =>
  buildSectorMesh(afSectorProfile.geometry(level).layers, selectionOf(afSectorProfile, level))

/** One room, `id` 'room', with the walls given by the index of the corner they start at (0 is the north wall). */
const room = (
  walls: Readonly<Record<number, AfWall2>> = {},
  more: Partial<AfSectorEntry2File> = {},
): AfSector2File =>
  toyAfSector({
    sectors: [
      {
        id: 'room',
        floor: 0,
        ceiling: 4,
        light: 1,
        corners: [
          [0, 0, walls[0]],
          [8, 0, walls[1]],
          [8, 6, walls[2]],
          [0, 6, walls[3]],
        ],
        ...more,
      },
    ],
  })

const only = (mesh: SectorMesh, role: SurfaceRole, sector?: string): Surface[] =>
  mesh.surfaces.filter(
    (surface) => surface.role === role && (sector === undefined || surface.sector === sector),
  )

const round = (value: number): number => Math.round(value * 1e4) / 1e4 + 0

const vertices = (surface: Surface): Vec3[] =>
  Array.from({ length: surface.positions.length / 3 }, (_, k) => [
    surface.positions[3 * k] as number,
    surface.positions[3 * k + 1] as number,
    surface.positions[3 * k + 2] as number,
  ])

/** A wall's rectangles, each as the 12 numbers of its four corners, in four decimals. */
const quads = (surface: Surface): number[][] =>
  Array.from({ length: surface.positions.length / 12 }, (_, k) =>
    surface.positions.slice(12 * k, 12 * k + 12).map(round),
  )

/** The triangle's normal by the right-hand rule (not unit), from its three corners in index order. */
function triangleNormal(surface: Surface, k: number): Vec3 {
  const [a, b, c] = [0, 1, 2].map((i) => {
    const at = 3 * (surface.indices[3 * k + i] as number)
    return surface.positions.slice(at, at + 3) as number[]
  }) as [number[], number[], number[]]
  const [u, v] = [
    b.map((value, i) => value - (a[i] as number)),
    c.map((value, i) => value - (a[i] as number)),
  ] as [number[], number[]]
  return [
    (u[1] as number) * (v[2] as number) - (u[2] as number) * (v[1] as number),
    (u[2] as number) * (v[0] as number) - (u[0] as number) * (v[2] as number),
    (u[0] as number) * (v[1] as number) - (u[1] as number) * (v[0] as number),
  ]
}

const area = (surface: Surface): number => {
  let sum = 0
  for (let k = 0; k < surface.indices.length / 3; k++) sum += Math.hypot(...triangleNormal(surface, k)) / 2
  return sum
}

const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0)

/** Every surface is made of triangles that exist, face the way the normal says, and have a unit normal. */
function expectWellFormed(mesh: SectorMesh): void {
  for (const surface of mesh.surfaces) {
    expect(surface.positions.length % 3).toBe(0)
    expect(surface.indices.length % 3).toBe(0)
    expect(surface.indices.length).toBeGreaterThan(0)
    for (const index of surface.indices) expect(index).toBeLessThan(surface.positions.length / 3)
    expect(Math.hypot(...surface.normal)).toBeCloseTo(1, 12)
    for (let k = 0; k < surface.indices.length / 3; k++) {
      const [x, y, z] = triangleNormal(surface, k)
      expect(x * surface.normal[0] + y * surface.normal[1] + z * surface.normal[2]).toBeGreaterThan(0)
    }
    expect(surface.shade).toBeGreaterThan(0)
    expect(surface.shade).toBeLessThanOrEqual(1)
  }
}

describe('buildSectorMesh floors, ceilings and walls', () => {
  const mesh = meshOf(room())
  const [floor, ceiling, ...walls] = mesh.surfaces as [Surface, Surface, ...Surface[]]

  it('gives a floor, a ceiling and a wall for each side, sector by sector', () => {
    expect(mesh.surfaces.map((surface) => surface.role)).toEqual([
      'floor',
      'ceiling',
      'wall',
      'wall',
      'wall',
      'wall',
    ])
    expect(mesh.surfaces.every((surface) => surface.sector === 'room')).toBe(true)
  })

  it('puts the floor at the floor height facing up and the ceiling at the ceiling height facing down', () => {
    expect(floor).toMatchObject({ selection: 'sector:room', normal: [0, 1, 0] })
    expect(vertices(floor).map((v) => v[1])).toEqual([0, 0, 0, 0])
    expect(area(floor)).toBeCloseTo(48, 9)
    expect(ceiling).toMatchObject({ selection: 'sector:room', normal: [0, -1, 0] })
    expect(vertices(ceiling).map((v) => v[1])).toEqual([4, 4, 4, 4])
    expect(area(ceiling)).toBeCloseTo(48, 9)
  })

  it('raises each floor and ceiling to its own sector heights, and keeps the plan z as z', () => {
    const level = room({}, { floor: 1.5, ceiling: 3.25 })
    const raised = meshOf(level)
    expect(vertices(raised.surfaces[0] as Surface).map((v) => v[1])).toEqual([1.5, 1.5, 1.5, 1.5])
    expect(vertices(raised.surfaces[1] as Surface).map((v) => v[1])).toEqual([3.25, 3.25, 3.25, 3.25])
    expect(Math.max(...vertices(floor).map((v) => v[2]))).toBe(6)
  })

  it('runs each wall corner to corner and floor to ceiling', () => {
    expect(walls.map(quads)).toEqual([
      [[0, 0, 0, 8, 0, 0, 8, 4, 0, 0, 4, 0]],
      [[8, 0, 0, 8, 0, 6, 8, 4, 6, 8, 4, 0]],
      [[8, 0, 6, 0, 0, 6, 0, 4, 6, 8, 4, 6]],
      [[0, 0, 6, 0, 0, 0, 0, 4, 0, 0, 4, 6]],
    ])
    for (const wall of walls) expect(wall.indices).toEqual([0, 1, 2, 0, 2, 3])
  })

  it('faces every wall into the room, with the normal of the plan: unit, and never -0', () => {
    expect(walls.map((wall) => wall.normal)).toEqual([
      [0, 0, 1],
      [-1, 0, 0],
      [0, 0, -1],
      [1, 0, 0],
    ])
    for (const wall of walls)
      for (const component of wall.normal) expect(Object.is(component, -0)).toBe(false)
  })

  it('names the selection of each surface: the sector for its floor and ceiling, the wall for a wall', () => {
    expect(walls.map((wall) => wall.selection)).toEqual([
      'wall:room/0',
      'wall:room/1',
      'wall:room/2',
      'wall:room/3',
    ])
  })

  it('winds every triangle the way its normal points, and addresses only positions it holds', () => {
    expectWellFormed(mesh)
  })

  it('keeps a wall of a diagonal exactly corner to corner', () => {
    const level = room(
      {},
      {
        corners: [
          [0, 0],
          [6, 8],
          [0, 8],
        ],
      },
    )
    const [, , diagonal] = meshOf(level).surfaces as [Surface, Surface, Surface]
    expect(quads(diagonal)).toEqual([[0, 0, 0, 6, 0, 8, 6, 4, 8, 0, 4, 0]])
    expect(diagonal.normal[0]).toBeCloseTo(-0.8, 12)
    expect(diagonal.normal[2]).toBeCloseTo(0.6, 12)
  })

  it('ends a wall exactly on its corners, whatever its slope', () => {
    let state = 7
    const random = (): number => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0
      return state / 4294967296
    }
    for (let k = 0; k < 200; k++) {
      const [x, z] = [round(random() * 20 - 10), round(random() * 20 - 10)]
      const level = room(
        {},
        {
          corners: [
            [0, 0],
            [x, z],
            [x + 1, z - 7],
          ],
        },
      )
      const resolved = afSectorProfile.geometry(level).layers[0]?.map.edges ?? []
      const surfaces = only(meshOf(level), 'wall')
      expect(surfaces).toHaveLength(resolved.length)
      resolved.forEach((edge, at) => {
        const [first] = surfaces[at]?.positions ?? []
        expect(surfaces[at]?.positions.slice(0, 9)).toEqual([
          edge.a.x,
          0,
          edge.a.z,
          edge.b.x,
          0,
          edge.b.z,
          edge.b.x,
          4,
          edge.b.z,
        ])
        expect(first).toBe(edge.a.x)
      })
    }
  })

  it('never gives a normal a -0, for a corner that is written as one', () => {
    const level = room(
      {},
      {
        corners: [
          [0, 6],
          [-0, 0],
          [8, 0],
          [8, 6],
        ],
      },
    )
    for (const surface of only(meshOf(level), 'wall'))
      for (const component of surface.normal) expect(Object.is(component, -0)).toBe(false)
  })

  it('is plain data: the same layers give the same mesh, which survives JSON', () => {
    expect(meshOf(room())).toEqual(mesh)
    expect(JSON.parse(JSON.stringify(mesh))).toEqual(mesh)
  })

  it('skips a wall of no length, and a sector with fewer than three corners has no floor or ceiling', () => {
    const repeated = meshOf(
      room(
        {},
        {
          corners: [
            [0, 0],
            [8, 0],
            [8, 0],
            [8, 6],
            [0, 6],
          ],
        },
      ),
    )
    expect(only(repeated, 'wall')).toHaveLength(4)
    expectWellFormed(repeated)
    const line = meshOf(
      room(
        {},
        {
          corners: [
            [0, 0],
            [8, 0],
          ],
        },
      ),
    )
    expect(only(line, 'floor')).toEqual([])
    expect(only(line, 'ceiling')).toEqual([])
  })
})

describe('buildSectorMesh floors with holes', () => {
  const pillar = (): AfSector2File =>
    room(
      {},
      {
        holes: [
          [
            [3, 2],
            [5, 2],
            [5, 4],
            [3, 4],
          ],
        ],
      },
    )

  it('leaves the hole out of the floor and the ceiling', () => {
    const mesh = meshOf(pillar())
    expect(area(only(mesh, 'floor')[0] as Surface)).toBeCloseTo(48 - 4, 9)
    expect(area(only(mesh, 'ceiling')[0] as Surface)).toBeCloseTo(48 - 4, 9)
    expectWellFormed(mesh)
  })

  it('faces the walls of the hole into the room, away from the hole', () => {
    const mesh = meshOf(pillar())
    const holeWalls = only(mesh, 'wall').slice(4)
    expect(holeWalls).toHaveLength(4)
    for (const wall of holeWalls) {
      const [first] = quads(wall) as [number[]]
      const middle = [
        (first[0] as number) + (first[3] as number),
        (first[2] as number) + (first[5] as number),
      ]
      const [awayX, awayZ] = [(middle[0] as number) / 2 - 4, (middle[1] as number) / 2 - 3]
      expect(awayX * wall.normal[0] + awayZ * wall.normal[2]).toBeGreaterThan(0)
      expect(wall.selection).toBe('sector:room')
    }
  })
})

describe('buildSectorMesh portals', () => {
  const toy = meshOf(toyAfSector())

  it('leaves a wall that opens onto a lower floor with nothing, and gives the lower room the step up', () => {
    // The hall's wall at x = 8 has no surface, so the hall has its floor, its ceiling and three walls.
    expect(only(toy, 'wall', 'hall').map((wall) => wall.selection)).toEqual([
      'wall:hall/0',
      'wall:hall/2',
      'wall:hall/3',
    ])
    expect(only(toy, 'lower', 'hall')).toEqual([])
    // The dock is half a metre lower: its wall on the line has the strip from its floor up to the hall's.
    const [step] = only(toy, 'lower', 'dock') as [Surface]
    expect(quads(step)).toEqual([[8, -0.5, 6, 8, -0.5, 0, 8, 0, 0, 8, 0, 6]])
    expect(step).toMatchObject({ selection: 'wall:dock/3', normal: [1, 0, 0] })
    expect(only(toy, 'upper')).toEqual([])
    expectWellFormed(toy)
  })

  it('gives an upper strip to a wall whose neighbour has the lower ceiling', () => {
    const low = meshOf(toyAfSector({ sectors: [toyHall, { ...toyDock, ceiling: 3 }] }))
    const [upper] = only(low, 'upper') as [Surface]
    expect(upper.sector).toBe('hall')
    expect(quads(upper)).toEqual([[8, 3, 0, 8, 3, 6, 8, 4, 6, 8, 4, 0]])
    expect(upper.selection).toBe('wall:hall/1')
    // The dock's wall sees a taller hall, and a lower floor than the hall's: only the step.
    expect(only(low, 'upper', 'dock')).toEqual([])
    expect(only(low, 'lower', 'dock')).toHaveLength(1)
  })

  it('gives both strips when the neighbour has a higher floor and a lower ceiling, and leaves the opening', () => {
    const slot = meshOf(
      toyAfSector({
        sectors: [
          { ...toyHall, floor: 0, ceiling: 4 },
          { ...toyDock, floor: 1, ceiling: 3 },
        ],
      }),
    )
    const [lower] = only(slot, 'lower', 'hall') as [Surface]
    const [upper] = only(slot, 'upper', 'hall') as [Surface]
    expect(quads(lower)).toEqual([[8, 0, 0, 8, 0, 6, 8, 1, 6, 8, 1, 0]])
    expect(quads(upper)).toEqual([[8, 3, 0, 8, 3, 6, 8, 4, 6, 8, 4, 0]])
    expect(only(slot, 'wall', 'hall').map((wall) => wall.selection)).not.toContain('wall:hall/1')
  })

  it('keeps a strip inside its own sector when the neighbour reaches past its ceiling or floor', () => {
    const tall = meshOf(toyAfSector({ sectors: [toyHall, { ...toyDock, floor: 9, ceiling: 12 }] }))
    const [lower] = only(tall, 'lower', 'hall') as [Surface]
    expect(quads(lower)).toEqual([[8, 0, 0, 8, 0, 6, 8, 4, 6, 8, 4, 0]])
    expect(only(tall, 'upper', 'hall')).toEqual([])
    const flat = meshOf(toyAfSector({ sectors: [{ ...toyHall, ceiling: 0 }, toyDock] }))
    expect(only(flat, 'wall', 'hall')).toEqual([])
  })

  it('ignores a door or a window on a portal wall, from either side: a portal is an opening already', () => {
    const cut = {
      door: { at: 3, width: 1, height: 2 },
      window: { at: 4.5, width: 1, y0: 0.1, y1: 1 },
    }
    const level = toyAfSector({
      sectors: [
        {
          ...toyHall,
          corners: [
            [0, 0],
            [8, 0, { next: 'dock', ...cut }],
            [8, 6],
            [0, 6],
          ],
        },
        {
          ...toyDock,
          corners: [
            [8, 0],
            [14, 0],
            [14, 6],
            [8, 6, { next: 'hall', ...cut }],
          ],
        },
      ],
    })
    expect(meshOf(level)).toEqual(toy)
  })
})

describe('buildSectorMesh doors', () => {
  const door = { at: 4, width: 1.2, height: 2.1 }
  const mesh = meshOf(room({ 0: { door } }))
  const [wall] = only(mesh, 'wall') as [Surface]
  const [panel] = only(mesh, 'door') as [Surface]

  it('cuts the wall round the door: the two sides and the header, and fills the opening with the door', () => {
    expect(quads(wall)).toEqual([
      [0, 0, 0, 3.4, 0, 0, 3.4, 4, 0, 0, 4, 0],
      [3.4, 2.1, 0, 4.6, 2.1, 0, 4.6, 4, 0, 3.4, 4, 0],
      [4.6, 0, 0, 8, 0, 0, 8, 4, 0, 4.6, 4, 0],
    ])
    expect(quads(panel)).toEqual([[3.4, 0, 0, 4.6, 0, 0, 4.6, 2.1, 0, 3.4, 2.1, 0]])
  })

  it('gives the door the wall’s sector, selection, normal and shade, and it is a closed panel in the wall plane', () => {
    expect(panel).toMatchObject({
      role: 'door',
      sector: 'room',
      selection: 'wall:room/0',
      normal: wall.normal,
    })
    expect(panel.shade).toBe(wall.shade)
    expect(area(panel)).toBeCloseTo(1.2 * 2.1, 9)
    expect(area(wall) + area(panel)).toBeCloseTo(32, 9)
    expectWellFormed(mesh)
  })

  it('puts the door right after its wall in the mesh', () => {
    const roles = mesh.surfaces.map((surface) => surface.role)
    expect(roles).toEqual(['floor', 'ceiling', 'wall', 'door', 'wall', 'wall', 'wall'])
  })

  it('measures the door along the wall from where the wall starts, on a wall that runs the other way', () => {
    // The south wall runs from x = 8 to x = 0, so 2 m along it is x = 6.
    const south = meshOf(room({ 2: { door: { at: 2, width: 1, height: 2 } } }))
    const [panelSouth] = only(south, 'door') as [Surface]
    expect(quads(panelSouth)).toEqual([[6.5, 0, 6, 5.5, 0, 6, 5.5, 2, 6, 6.5, 2, 6]])
  })

  it('measures along a diagonal wall by the metre', () => {
    const door = { at: 5, width: 2, height: 2 }
    const level = room(
      {},
      {
        corners: [
          [0, 0, { door }],
          [6, 8],
          [0, 8],
        ],
      },
    )
    const [diagonalDoor] = only(meshOf(level), 'door') as [Surface]
    expect(quads(diagonalDoor)).toEqual([[2.4, 0, 3.2, 3.6, 0, 4.8, 3.6, 2, 4.8, 2.4, 2, 3.2]])
  })

  it('leaves out a header when the door reaches the ceiling, and the whole door when it has no size', () => {
    const tall = meshOf(room({ 0: { door: { at: 4, width: 1, height: 9 } } }))
    expect(quads(only(tall, 'wall')[0] as Surface)).toHaveLength(2)
    expect(quads(only(tall, 'door')[0] as Surface)).toEqual([[3.5, 0, 0, 4.5, 0, 0, 4.5, 4, 0, 3.5, 4, 0]])
    for (const empty of [
      { at: 4, width: 1, height: 0 },
      { at: 4, width: 0, height: 2 },
      { at: 4, width: 1, height: -1 },
    ]) {
      const none = meshOf(room({ 0: { door: empty } }))
      expect(only(none, 'door')).toEqual([])
      expect(quads(only(none, 'wall')[0] as Surface)).toHaveLength(1)
    }
  })

  it('stops a door and a window at the ceiling of a room whose floor is raised', () => {
    const raised = meshOf(
      room(
        { 0: { door: { at: 2, width: 1, height: 9 }, window: { at: 6, width: 1, y0: 1, y1: 9 } } },
        { floor: 1 },
      ),
    )
    expect(quads(only(raised, 'door')[0] as Surface)).toEqual([[1.5, 1, 0, 2.5, 1, 0, 2.5, 4, 0, 1.5, 4, 0]])
    // The window runs from a metre above the floor to the ceiling, so there is a strip under it and none over it.
    expect(quads(only(raised, 'wall')[0] as Surface)).toContainEqual([
      5.5, 1, 0, 6.5, 1, 0, 6.5, 2, 0, 5.5, 2, 0,
    ])
    expect(quads(only(raised, 'wall')[0] as Surface)).toHaveLength(4)
  })

  it('clips a door that runs past the end of its wall, and leaves out one that is not on the wall', () => {
    const edge = meshOf(room({ 0: { door: { at: 7.5, width: 2, height: 2 } } }))
    expect(quads(only(edge, 'door')[0] as Surface)).toEqual([[6.5, 0, 0, 8, 0, 0, 8, 2, 0, 6.5, 2, 0]])
    const start = meshOf(room({ 0: { door: { at: 0.5, width: 2, height: 2 } } }))
    expect(quads(only(start, 'door')[0] as Surface)).toEqual([[0, 0, 0, 1.5, 0, 0, 1.5, 2, 0, 0, 2, 0]])
    for (const at of [-5, 20]) {
      const off = meshOf(room({ 0: { door: { at, width: 1, height: 2 } } }))
      expect(only(off, 'door')).toEqual([])
      expect(quads(only(off, 'wall')[0] as Surface)).toHaveLength(1)
    }
  })

  it('raises the door with the floor, and stops it at the ceiling', () => {
    const raised = meshOf(room({ 0: { door: { at: 4, width: 1, height: 2 } } }, { floor: 1, ceiling: 4 }))
    expect(quads(only(raised, 'door')[0] as Surface)).toEqual([[3.5, 1, 0, 4.5, 1, 0, 4.5, 3, 0, 3.5, 3, 0]])
  })

  it('keeps a window that lies inside the door’s opening from cutting the wall again', () => {
    const inside = meshOf(room({ 0: { door, window: { at: 4, width: 0.4, y0: 0.5, y1: 1.5 } } }))
    expect(quads(only(inside, 'wall')[0] as Surface)).toEqual(quads(wall))
  })

  it('numbers the corners of each rectangle of a wall in turn', () => {
    expect(wall.indices).toEqual([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11])
  })

  it('orders the cuts of a long wall by the metre, not as text', () => {
    const wide = room(
      {},
      {
        corners: [
          [0, 0, { door: { at: 10, width: 1, height: 2 } }],
          [12, 0],
          [12, 6],
          [0, 6],
        ],
      },
    )
    expect(quads(only(meshOf(wide), 'wall')[0] as Surface)).toEqual([
      [0, 0, 0, 9.5, 0, 0, 9.5, 4, 0, 0, 4, 0],
      [9.5, 2, 0, 10.5, 2, 0, 10.5, 4, 0, 9.5, 4, 0],
      [10.5, 0, 0, 12, 0, 0, 12, 4, 0, 10.5, 4, 0],
    ])
  })

  it('agrees with the plan on where the door is, on a room that is drawn the other way round', () => {
    const level = toyAfSector({
      sectors: [
        {
          id: 'room',
          floor: 0,
          ceiling: 4,
          light: 1,
          corners: [
            [0, 0],
            [0, 6, { door: { at: 1.5, width: 1, height: 2 } }],
            [8, 6],
            [8, 0],
          ],
        },
      ],
    })
    const layers = afSectorProfile.geometry(level).layers
    const select = selectionOf(afSectorProfile, level)
    const planned = planScene(layers, select).walls.find((wall) => wall.kind === 'door')
    const [panelHere] = only(buildSectorMesh(layers, select), 'door') as [Surface]
    const [x0, , z0, x1, , z1] = quads(panelHere)[0] as number[]
    const from = planned?.a as { x: number; z: number }
    // The plan's span is metres from the wall's start `a`, and the panel's two ends are at those distances from it.
    const distances = [
      Math.hypot((x0 as number) - from.x, (z0 as number) - from.z),
      Math.hypot((x1 as number) - from.x, (z1 as number) - from.z),
    ]
    expect(distances.map(round)).toEqual(planned?.span?.map(round))
    expect(planned?.span).toEqual([1, 2])
  })
})

describe('buildSectorMesh windows', () => {
  const window = { at: 4, width: 2, y0: 1, y1: 2.5 }
  const mesh = meshOf(room({ 0: { window } }))
  const [wall] = only(mesh, 'wall') as [Surface]

  it('leaves the window open: strips round it, and no pane', () => {
    expect(quads(wall)).toEqual([
      [0, 0, 0, 3, 0, 0, 3, 4, 0, 0, 4, 0],
      [3, 0, 0, 5, 0, 0, 5, 1, 0, 3, 1, 0],
      [3, 2.5, 0, 5, 2.5, 0, 5, 4, 0, 3, 4, 0],
      [5, 0, 0, 8, 0, 0, 8, 4, 0, 5, 4, 0],
    ])
    expect(only(mesh, 'door')).toEqual([])
    expect(area(wall)).toBeCloseTo(32 - 2 * 1.5, 9)
    expectWellFormed(mesh)
  })

  it('lifts the window with the floor', () => {
    const raised = meshOf(room({ 0: { window } }, { floor: 0.5 }))
    const [strip] = only(raised, 'wall') as [Surface]
    expect(quads(strip)[1]).toEqual([3, 0.5, 0, 5, 0.5, 0, 5, 1.5, 0, 3, 1.5, 0])
    expect(quads(strip)[2]).toEqual([3, 3, 0, 5, 3, 0, 5, 4, 0, 3, 4, 0])
  })

  it('has no strip below or above a window that reaches the floor or the ceiling, whatever its heights say', () => {
    const tall = meshOf(room({ 0: { window: { at: 4, width: 2, y0: -1, y1: 9 } } }))
    expect(quads(only(tall, 'wall')[0] as Surface)).toEqual([
      [0, 0, 0, 3, 0, 0, 3, 4, 0, 0, 4, 0],
      [5, 0, 0, 8, 0, 0, 8, 4, 0, 5, 4, 0],
    ])
  })

  it('leaves out a window with no size', () => {
    for (const empty of [
      { at: 4, width: 2, y0: 2, y1: 2 },
      { at: 4, width: 2, y0: 3, y1: 1 },
      { at: 4, width: 0, y0: 1, y1: 2 },
      { at: 4, width: 2, y0: 5, y1: 6 },
    ]) {
      const none = meshOf(room({ 0: { window: empty } }))
      expect(quads(only(none, 'wall')[0] as Surface)).toHaveLength(1)
    }
  })

  it('cuts a door and a window of one wall, and does not cut twice where they overlap', () => {
    const apart = meshOf(
      room({
        0: { door: { at: 1.6, width: 1.2, height: 2.1 }, window: { at: 6, width: 2, y0: 1, y1: 2.5 } },
      }),
    )
    expect(area(only(apart, 'wall')[0] as Surface)).toBeCloseTo(32 - 1.2 * 2.1 - 2 * 1.5, 9)
    const overlap = meshOf(
      room({ 0: { door: { at: 4, width: 1.2, height: 2.1 }, window: { at: 4.5, width: 1, y0: 1, y1: 3 } } }),
    )
    // The door is 3.4 to 4.6 up to 2.1, the window 4 to 5 from 1 to 3: together 2.52 + 2 - 0.66.
    expect(area(only(overlap, 'wall')[0] as Surface)).toBeCloseTo(32 - 3.86, 9)
    expect(area(only(overlap, 'door')[0] as Surface)).toBeCloseTo(2.52, 9)
    expectWellFormed(overlap)
  })
})

describe('faceShade', () => {
  it('lights a face that looks up more than a wall, and a wall more than a face that looks down', () => {
    const up = faceShade([0, 1, 0], 1)
    for (const wall of [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 0, 1],
      [0, 0, -1],
    ] as const) {
      expect(up).toBeGreaterThan(faceShade(wall, 1))
      expect(faceShade(wall, 1)).toBeGreaterThanOrEqual(faceShade([0, -1, 0], 1))
    }
  })

  it('tells the walls apart by the way they face', () => {
    expect(faceShade([1, 0, 0], 1)).not.toBe(faceShade([-1, 0, 0], 1))
    expect(faceShade([0, 0, 1], 1)).not.toBe(faceShade([0, 0, -1], 1))
  })

  it('is darker for a darker sector, and never above 1', () => {
    for (const normal of [
      [0, 1, 0],
      [0, -1, 0],
      [1, 0, 0],
      [0, 0, 1],
      [-0.6, 0, 0.8],
    ] as const) {
      expect(faceShade(normal, 0.5)).toBeLessThan(faceShade(normal, 1))
      expect(faceShade(normal, 0)).toBeLessThan(faceShade(normal, 0.5))
      for (const light of [0, 0.3, 1, 2, 50]) expect(faceShade(normal, light)).toBeLessThanOrEqual(1)
    }
  })

  it('keeps a dark sector visible, and treats a light above 1 as 1 and one below 0 as 0', () => {
    expect(faceShade([0, 0, 1], 0)).toBeGreaterThan(0.1)
    expect(faceShade([0, 1, 0], 3)).toBe(faceShade([0, 1, 0], 1))
    expect(faceShade([0, 1, 0], -2)).toBe(faceShade([0, 1, 0], 0))
  })

  it('holds a normal that is not unit to 1 too', () => {
    expect(faceShade([0, 5, 0], 1)).toBeLessThanOrEqual(1)
    expect(faceShade([0, 5, 0], 1)).toBeCloseTo(1, 12)
  })

  it('pins the values the mesh is shaded with', () => {
    expect(faceShade([0, 1, 0], 1)).toBeCloseTo(0.90955, 5)
    expect(faceShade([0, -1, 0], 1)).toBeCloseTo(0.55, 4)
    expect(faceShade([1, 0, 0], 1)).toBeCloseTo(0.7298, 4)
    expect(faceShade([0, 0, 1], 0.5)).toBeCloseTo(0.5078, 4)
    expect(faceShade([0, 1, 0], 0)).toBeCloseTo(0.31834, 5)
  })

  it('shades each surface by its sector’s light and its normal', () => {
    const mesh = meshOf(toyAfSector())
    for (const surface of mesh.surfaces) {
      const light = surface.sector === 'dock' ? 0.7 : 1
      expect(surface.shade).toBe(faceShade(surface.normal, light))
    }
  })
})

describe('buildSectorMesh bounds', () => {
  it('is the box of everything in the mesh', () => {
    expect(meshOf(toyAfSector()).bounds).toEqual({ min: [0, -0.5, 0], max: [14, 4, 6] })
    expect(meshOf(room()).bounds).toEqual({ min: [0, 0, 0], max: [8, 4, 6] })
  })

  it('is exact for a room far from the origin, in positive or negative coordinates and heights', () => {
    const at = (x: number, z: number, floor: number, ceiling: number) =>
      meshOf(
        room(
          {},
          {
            floor,
            ceiling,
            corners: [
              [x, z],
              [x + 4, z],
              [x + 4, z + 4],
              [x, z + 4],
            ],
          },
        ),
      ).bounds
    expect(at(10, 5, 1, 4)).toEqual({ min: [10, 1, 5], max: [14, 4, 9] })
    expect(at(-14, -9, -6, -2)).toEqual({ min: [-14, -6, -9], max: [-10, -2, -5] })
  })

  it('is a room-sized default box for a level with no sectors, whether it has a layer or none', () => {
    expect(EMPTY_BOUNDS).toEqual({ min: [-5, 0, -5], max: [5, 3, 5] })
    const level = toyAfSector({ sectors: [] })
    expect(meshOf(level)).toEqual({ surfaces: [], bounds: EMPTY_BOUNDS })
    expect(buildSectorMesh([], selectionOf(afSectorProfile, level))).toEqual({
      surfaces: [],
      bounds: EMPTY_BOUNDS,
    })
  })

  it('reads every layer, in order', () => {
    const level = toyAfSector()
    const layers = afSectorProfile.geometry(level).layers
    const twice = buildSectorMesh([...layers, ...layers], selectionOf(afSectorProfile, level))
    expect(twice.surfaces).toHaveLength(2 * meshOf(level).surfaces.length)
    expect(twice.surfaces.slice(0, meshOf(level).surfaces.length)).toEqual(meshOf(level).surfaces)
  })
})

describe('buildSectorMesh occlusion (ED3D.4b)', () => {
  const occludeOfWall = (mesh: SectorMesh, selection: string): string[] =>
    mesh.surfaces.filter((surface) => surface.selection === selection).map((surface) => surface.occlude)

  it('says cut for a wall that says nothing, and what a wall says for a wall that does', () => {
    const mesh = meshOf(room({ 0: { occlude: 'never' }, 1: { occlude: 'fade' }, 2: { occlude: 'cut' } }))
    expect(occludeOfWall(mesh, 'wall:room/0')).toEqual(['never'])
    expect(occludeOfWall(mesh, 'wall:room/1')).toEqual(['fade'])
    expect(occludeOfWall(mesh, 'wall:room/2')).toEqual(['cut'])
    expect(occludeOfWall(mesh, 'wall:room/3')).toEqual(['cut'])
  })

  it('gives a floor never and a ceiling cut, whatever the walls say', () => {
    const mesh = meshOf(room({ 0: { occlude: 'never' }, 1: { occlude: 'fade' } }))
    expect(only(mesh, 'floor').map((surface) => surface.occlude)).toEqual(['never'])
    expect(only(mesh, 'ceiling').map((surface) => surface.occlude)).toEqual(['cut'])
  })

  it('gives every surface a wall makes the wall’s occlusion: its strips, its header and its door', () => {
    const door = { at: 4, width: 1.2, height: 2.1 }
    const mesh = meshOf(room({ 0: { door, occlude: 'fade' } }))
    const north = mesh.surfaces.filter((surface) => surface.selection === 'wall:room/0')
    expect(north.map((surface) => surface.role)).toEqual(['wall', 'door'])
    expect(north.map((surface) => surface.occlude)).toEqual(['fade', 'fade'])
  })

  it('gives the strips of a portal wall the occlusion of the wall they belong to, each side its own', () => {
    const level = toyAfSector({
      sectors: [
        {
          ...toyHall,
          corners: [
            [0, 0],
            [8, 0, { next: 'dock', occlude: 'fade' }],
            [8, 6],
            [0, 6],
          ],
        },
        {
          ...toyDock,
          ceiling: 3,
          corners: [
            [8, 0],
            [14, 0],
            [14, 6],
            [8, 6, { next: 'hall', occlude: 'never' }],
          ],
        },
      ],
    })
    const mesh = meshOf(level)
    expect(only(mesh, 'upper', 'hall').map((surface) => surface.occlude)).toEqual(['fade'])
    expect(only(mesh, 'lower', 'dock').map((surface) => surface.occlude)).toEqual(['never'])
  })

  it('reads a value the format does not know as cut', () => {
    const odd = { occlude: 'sideways' } as unknown as AfWall2
    const mesh = meshOf(room({ 0: odd }))
    expect(occludeOfWall(mesh, 'wall:room/0')).toEqual(['cut'])
  })

  it('is cut for every wall of the depot and never for its floors', () => {
    for (const surface of meshOf(depot()).surfaces)
      expect(surface.occlude).toBe(surface.role === 'floor' ? 'never' : 'cut')
  })
})

/** The depot sample, with a hole cut in its hall so the floor and ceiling have something to take out. */
const depot = (): AfSector2File => {
  const parsed = afSectorProfile.parse(loadAuthored('depot.af-sector'))
  if (!parsed.ok) throw new Error('the depot does not parse')
  const [hall, ...rest] = parsed.value.sectors
  const hole = [
    [2, 2],
    [4, 2],
    [4, 4],
    [2, 4],
  ] as const
  return { ...parsed.value, sectors: [{ ...(hall as AfSectorEntry2File), holes: [hole] }, ...rest] }
}

describe('buildSectorMesh on the depot', () => {
  const level = depot()
  const layers = afSectorProfile.geometry(level).layers
  const mesh = buildSectorMesh(layers, selectionOf(afSectorProfile, level))
  const sectors = layers.flatMap((layer) => layer.map.sectors)

  it('is well formed, and every triangle of every surface faces the way its normal says', () => {
    expect(mesh.surfaces.length).toBeGreaterThan(sectors.length * 2)
    expectWellFormed(mesh)
  })

  it('gives every surface a selection: the file lists every sector the geometry has', () => {
    for (const surface of mesh.surfaces) expect(surface.selection).toBeDefined()
  })

  it('has the floor of every sector, with its holes taken out', () => {
    expect(sectors.some((sector) => sector.points.length > 1)).toBe(true)
    for (const sector of sectors) {
      const [outline = [], ...holes] = sector.points
      const [floor] = only(mesh, 'floor', sector.id)
      const [ceiling] = only(mesh, 'ceiling', sector.id)
      const expected = Math.abs(polygonArea(outline)) - sum(holes.map((hole) => Math.abs(polygonArea(hole))))
      expect(area(floor as Surface)).toBeCloseTo(expected, 6)
      expect(area(ceiling as Surface)).toBeCloseTo(expected, 6)
    }
  })

  it('has a door panel for each door of a wall that leads nowhere, and for no other', () => {
    const doors = layers
      .flatMap((layer) => layer.map.edges)
      .filter((edge) => edge.next === undefined && edge.wall.door !== undefined)
    expect(doors).toHaveLength(1)
    expect(only(mesh, 'door')).toHaveLength(doors.length)
  })
})

describe('buildSectorMesh: what covers each surface', () => {
  const textured = room(
    { 0: { surface: 'brick' } },
    { floorTexture: 'oak', ceilingTexture: 'plaster', wallTexture: 'wallpaper' },
  )
  const mesh = meshOf(textured)

  it('names the floor, the ceiling and the walls by the swatch that covers them', () => {
    expect(only(mesh, 'floor')[0]?.texture).toBe('oak')
    expect(only(mesh, 'ceiling')[0]?.texture).toBe('plaster')
  })

  it("gives a wall its own surface, and the room's wall texture when it has none", () => {
    const [north, east] = [
      mesh.surfaces.find((surface) => surface.role === 'wall' && surface.selection === 'wall:room/0'),
      mesh.surfaces.find((surface) => surface.role === 'wall' && surface.selection === 'wall:room/1'),
    ]
    expect(north?.texture).toBe('brick')
    expect(east?.texture).toBe('wallpaper')
  })

  it('names nothing for a room that says nothing, and for a door panel', () => {
    const bare = meshOf(room({ 0: { door: { at: 4, width: 1.2, height: 2.4 } } }))
    expect(only(bare, 'floor')[0]?.texture).toBeUndefined()
    expect(only(bare, 'door')[0]?.texture).toBeUndefined()
  })
})

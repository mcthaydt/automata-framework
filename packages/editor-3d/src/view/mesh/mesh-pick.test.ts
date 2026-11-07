// Cutaway and picking in 3D (ED3D.4 step 8, ED3D spec §6 and flow 4): which surfaces the eye sees, and what a ray from the
// eye hits first among them. A surface that faces away from the eye is cut away, so the dollhouse sees into a room through
// its near walls and Walk, inside the room, sees them all. Rooms are 8 m by 6 m and 4 m high.

import type { AfSector, AfSectorEntry, AfWall } from '@automata/3d/level'
import { describe, expect, it } from 'vitest'
import { afSectorProfile } from '../../profile/af-sector-profile'
import { toyAfSector } from '../../testing/toy-af-sector'
import { type SelectionOf, selectionOf } from '../selection-of'
import { type Camera3D, fitOrbit, orbitCamera, projectPoint, rayThrough, walkCamera } from './camera-3d'
import { facesEye, pickMesh, surfaceVisibility, visibleSurfaces } from './mesh-pick'
import { buildSectorMesh, type SectorMesh, type Surface, type Vec3 } from './sector-mesh'
import { dot, length, sub } from './vec3'

const DEGREES = Math.PI / 180
const SIZE = { w: 800, h: 600 }
const CENTRE = { x: 400, y: 300 }

const entry = (
  id: string,
  [x0, z0, x1, z1]: readonly [number, number, number, number],
  walls: Readonly<Record<number, AfWall>> = {},
  more: Partial<AfSectorEntry> = {},
): AfSectorEntry => ({
  id,
  floor: 0,
  ceiling: 4,
  light: 1,
  corners: [
    [x0, z0, walls[0]],
    [x1, z0, walls[1]],
    [x1, z1, walls[2]],
    [x0, z1, walls[3]],
  ],
  ...more,
})

const level = (...sectors: AfSectorEntry[]): AfSector => toyAfSector({ sectors })

const meshOf = (data: AfSector, select?: SelectionOf): SectorMesh =>
  buildSectorMesh(afSectorProfile.geometry(data).layers, select ?? selectionOf(afSectorProfile, data))

/** One room, 'room', from the origin to (8, 6). */
const room = (walls: Readonly<Record<number, AfWall>> = {}): AfSector =>
  level(entry('room', [0, 0, 8, 6], walls))

/** A camera standing in the room at (4, 3), eye height 1.6, looking along the heading with the pitch. */
const standing = (heading = 0, pitch = 0): Camera3D => ({ ...walkCamera({ x: 4, z: 3 }, 0, heading), pitch })

const pickAt = (mesh: SectorMesh, camera: Camera3D, at: { x: number; y: number } = CENTRE) =>
  pickMesh(mesh, rayThrough(camera, SIZE, at))

/** The pixel a point of the world is drawn at. */
function pixelOf(camera: Camera3D, point: Vec3): { x: number; y: number } {
  const hit = projectPoint(camera, SIZE, point)
  if (hit === undefined) throw new Error('the point is behind the camera')
  return { x: hit.x, y: hit.y }
}

const near = (actual: readonly number[], expected: readonly number[]): void =>
  expected.forEach((value, k) => {
    expect(actual[k] as number).toBeCloseTo(value, 9)
  })

const labels = (surfaces: readonly Surface[]) =>
  surfaces.map((surface) => `${surface.role}:${surface.selection}`)

describe('facesEye', () => {
  const mesh = meshOf(room())
  const [floor, ceiling, north, east, south, west] = mesh.surfaces as [
    Surface,
    Surface,
    Surface,
    Surface,
    Surface,
    Surface,
  ]

  it('faces an eye in the room to every surface of it', () => {
    for (const surface of mesh.surfaces) expect(facesEye(surface, [4, 1.6, 3])).toBe(true)
  })

  it('cuts the walls the eye is outside of, and the ceiling it is above, but not the floor', () => {
    const outside: Vec3 = [-5, 9, 12]
    expect([floor, ceiling, north, east, south, west].map((surface) => facesEye(surface, outside))).toEqual([
      true,
      false,
      true,
      true,
      false,
      false,
    ])
  })

  it('shows the underside of the floor and the ceiling to an eye under them, and not the other side', () => {
    expect(facesEye(floor, [4, -1, 3])).toBe(false)
    expect(facesEye(ceiling, [4, 5, 3])).toBe(false)
    expect(facesEye(ceiling, [4, 3.9, 3])).toBe(true)
    expect(facesEye(floor, [4, 0.1, 3])).toBe(true)
  })

  it('does not face an eye that is exactly in the plane of the surface', () => {
    expect(facesEye(floor, [4, 0, 3])).toBe(false)
    expect(facesEye(north, [4, 1, 0])).toBe(false)
    expect(facesEye(north, [4, 1, 0.001])).toBe(true)
  })

  it('looks at the plane of the surface, not at the point of it nearest the eye', () => {
    expect(facesEye(north, [100, 1, 1])).toBe(true)
    expect(facesEye(north, [100, 1, -1])).toBe(false)
  })
})

describe('visibleSurfaces', () => {
  const mesh = meshOf(room())

  it('keeps every surface for an eye inside the room, in mesh order', () => {
    expect(visibleSurfaces(mesh, [4, 1.6, 3])).toEqual(mesh.surfaces)
  })

  it('cuts the near walls and the ceiling from the home orbit, which looks from the south-west and above', () => {
    const camera = orbitCamera(fitOrbit(mesh.bounds, SIZE))
    expect(camera.eye[0]).toBeLessThan(0)
    expect(camera.eye[2]).toBeGreaterThan(6)
    expect(labels(visibleSurfaces(mesh, camera.eye))).toEqual([
      'floor:sector:room',
      'wall:wall:room/0',
      'wall:wall:room/1',
    ])
  })

  it('cuts the near walls from every one of the eight headings of the dollhouse', () => {
    for (let k = 0; k < 8; k++) {
      const camera = orbitCamera(fitOrbit(mesh.bounds, SIZE, { yaw: k * 45 * DEGREES }))
      const shown = visibleSurfaces(mesh, camera.eye)
      expect(shown.some((surface) => surface.role === 'ceiling')).toBe(false)
      expect(shown.some((surface) => surface.role === 'floor')).toBe(true)
      // The walls that show are the ones whose room side the eye is on: two for a diagonal heading, and for a straight one
      // the far wall and the two side walls, because the eye is level with the middle of the room.
      const walls = shown.filter((surface) => surface.role === 'wall')
      expect(walls.length).toBe(k % 2 === 1 ? 2 : 3)
    }
  })

  it('keeps nothing of a mesh with no surfaces', () => {
    expect(visibleSurfaces({ surfaces: [], bounds: mesh.bounds }, [0, 0, 0])).toEqual([])
  })
})

describe('surfaceVisibility and the wall occlusion (ED3D.4b)', () => {
  // The north wall is cut as ever, the east one fades, the south one never goes and the west one fades.
  const mesh = meshOf(room({ 1: { occlude: 'fade' }, 2: { occlude: 'never' }, 3: { occlude: 'fade' } }))
  const [floor, ceiling, north, east, south, west] = mesh.surfaces as [
    Surface,
    Surface,
    Surface,
    Surface,
    Surface,
    Surface,
  ]
  const outside: Vec3 = [-5, 9, 12]
  const all = [floor, ceiling, north, east, south, west]

  it('shows every surface to an eye inside the room, whatever it says', () => {
    expect(all.map((surface) => surfaceVisibility(surface, [4, 1.6, 3]))).toEqual(Array(6).fill('shown'))
  })

  it('cuts a cut surface that faces away, fades a fade one, and keeps a never one, from outside', () => {
    expect(all.map((surface) => surfaceVisibility(surface, outside))).toEqual([
      'shown', // the floor
      'cut', // the ceiling, which the eye is above
      'shown', // the north wall, which the eye sees the inside of
      'shown', // the east wall, which fades only where it would be cut
      'shown', // the south wall: never
      'faded', // the west wall: fade, and the eye is on its outer side
    ])
    const plain = meshOf(room()).surfaces
    expect(plain.map((surface) => surfaceVisibility(surface, outside))).toEqual([
      'shown',
      'cut',
      'shown',
      'shown',
      'cut',
      'cut',
    ])
  })

  it('keeps what is shown or faded and drops what is cut, in mesh order', () => {
    expect(labels(visibleSurfaces(mesh, outside))).toEqual([
      'floor:sector:room',
      'wall:wall:room/0',
      'wall:wall:room/1',
      'wall:wall:room/2',
      'wall:wall:room/3',
    ])
  })

  it('shows a floor that never goes to an eye below it, and cuts a ceiling to an eye above it', () => {
    expect(surfaceVisibility(floor, [4, -1, 3])).toBe('shown')
    expect(surfaceVisibility(ceiling, [4, 5, 3])).toBe('cut')
    expect(surfaceVisibility(ceiling, [4, 3.9, 3])).toBe('shown')
  })

  it('lets a ray through a cut wall, stops at a never wall from outside, and picks a faded one', () => {
    const looking = (walls: Readonly<Record<number, AfWall>>) =>
      pickMesh(meshOf(room(walls)), { origin: [4, 1.6, 12], direction: [0, 0, -1] })
    expect(looking({})).toMatchObject({ selection: 'wall:room/0', distance: 12 })
    expect(looking({ 2: { occlude: 'never' } })).toMatchObject({ selection: 'wall:room/2', distance: 6 })
    expect(looking({ 2: { occlude: 'fade' } })).toMatchObject({ selection: 'wall:room/2', distance: 6 })
  })
})

describe('pickMesh', () => {
  it('hits the wall the camera looks at, with its selection, the point and the distance', () => {
    const hit = pickAt(meshOf(room()), standing(0))
    expect(hit).toMatchObject({ role: 'wall', sector: 'room', selection: 'wall:room/0' })
    near(hit?.point ?? [], [4, 1.6, 0])
    expect(hit?.distance).toBeCloseTo(3, 9)
    expect(meshOf(room()).surfaces[hit?.index ?? -1]).toMatchObject({ selection: 'wall:room/0' })
  })

  it('hits each of the four walls from the middle of the room', () => {
    const mesh = meshOf(room())
    const ahead = [
      [0, 'wall:room/0', 3],
      [90, 'wall:room/1', 4],
      [180, 'wall:room/2', 3],
      [270, 'wall:room/3', 4],
    ] as const
    for (const [heading, selection, distance] of ahead) {
      const hit = pickAt(mesh, standing(heading * DEGREES))
      expect(hit?.selection).toBe(selection)
      expect(hit?.distance).toBeCloseTo(distance, 9)
    }
  })

  it('hits the floor as the sector, and the ceiling too', () => {
    const mesh = meshOf(room())
    const down = pickAt(mesh, standing(0, -45 * DEGREES))
    expect(down).toMatchObject({ role: 'floor', sector: 'room', selection: 'sector:room' })
    near(down?.point ?? [], [4, 0, 3 - 1.6])
    expect(down?.distance).toBeCloseTo(1.6 * Math.SQRT2, 9)
    const up = pickAt(mesh, standing(0, 45 * DEGREES))
    expect(up).toMatchObject({ role: 'ceiling', selection: 'sector:room' })
    near(up?.point ?? [], [4, 4, 3 - 2.4])
  })

  it('hits the door panel through the door, and the wall over it', () => {
    const mesh = meshOf(room({ 0: { door: { at: 4, width: 1.2, height: 2.1 } } }))
    expect(pickAt(mesh, standing(0))).toMatchObject({ role: 'door', selection: 'wall:room/0' })
    // Looking up so that the ray crosses the wall at 3 m, over the door.
    const over = pickAt(mesh, standing(0, Math.atan2(3 - 1.6, 3)))
    expect(over).toMatchObject({ role: 'wall', selection: 'wall:room/0' })
    near(over?.point ?? [], [4, 3, 0])
    // Beside the door, at the same height.
    const beside = pickAt(mesh, { ...standing(0), eye: [1, 1.6, 3] })
    expect(beside).toMatchObject({ role: 'wall' })
  })

  it('sees through a window to what is behind it, and hits the wall where there is no window', () => {
    const window = { at: 4, width: 2, y0: 1, y1: 2.5 }
    const behind = entry('beyond', [0, -6, 8, 0])
    const open = meshOf(level(entry('room', [0, 0, 8, 6], { 0: { window } }), behind))
    // The eye at height 1.6 looks through the window at the far wall of the room beyond, 9 m away.
    const through = pickAt(open, standing(0))
    expect(through).toMatchObject({ sector: 'beyond' })
    expect(through?.distance).toBeCloseTo(9, 9)
    near(through?.point ?? [], [4, 1.6, -6])
    // Off to the side, the wall is solid, and the wall of the room beyond that is back to back with it is not the one hit.
    const solid = pickAt(open, { ...standing(0), eye: [1, 1.6, 3] })
    expect(solid).toMatchObject({ sector: 'room', selection: 'wall:room/0' })
    expect(solid?.distance).toBeCloseTo(3, 9)
  })

  it('hits only the wall of two that stand back to back that faces the eye, from either side', () => {
    const mesh = meshOf(level(entry('room', [0, 0, 8, 6]), entry('beyond', [0, -6, 8, 0])))
    expect(pickAt(mesh, standing(0))).toMatchObject({ sector: 'room', selection: 'wall:room/0' })
    const other: Camera3D = { eye: [4, 1.6, -3], yaw: 180 * DEGREES, pitch: 0, fov: standing().fov }
    expect(pickAt(mesh, other)).toMatchObject({ sector: 'beyond' })
    expect(pickAt(mesh, other)?.distance).toBeCloseTo(3, 9)
  })

  it('passes through a wall that is cut away, to what is behind it', () => {
    const mesh = meshOf(room())
    const camera = orbitCamera(fitOrbit(mesh.bounds, SIZE))
    // Aimed at the floor in the middle of the room, the ray crosses the south wall (6 m, at about 3 m high) on the way.
    const aim: Vec3 = [4, 0, 3]
    const hit = pickAt(mesh, camera, pixelOf(camera, aim))
    expect(hit).toMatchObject({ role: 'floor', selection: 'sector:room' })
    near(hit?.point ?? [], aim)
    expect(hit?.distance).toBeCloseTo(length(sub(aim, camera.eye)), 7)
    // Aimed at the middle of the south wall from outside, nothing of the wall is hit: the ray goes in and meets the north wall.
    expect(pickAt(mesh, camera, pixelOf(camera, [4, 2, 6]))?.selection).not.toBe('wall:room/2')
  })

  it('hits the far wall for a ray in through a cut-away wall, and the ceiling is not in the way from above', () => {
    const mesh = meshOf(room())
    const camera = orbitCamera(fitOrbit(mesh.bounds, SIZE))
    const hit = pickAt(mesh, camera, pixelOf(camera, [4, 4, 0]))
    expect(hit?.selection).toBe('wall:room/0')
    near(hit?.point ?? [], [4, 4, 0])
  })

  it('gives a hit with no selection for a surface that nothing selects, and goes no further', () => {
    const data = level(
      entry('a', [0, 0, 8, 6], { 1: { next: 'b' } }),
      entry('b', [8, 0, 14, 6], { 3: { next: 'a' } }),
      entry('c', [14, 0, 20, 6]),
    )
    const real = selectionOf(afSectorProfile, data)
    const blind: SelectionOf = {
      ...real,
      sector: (id) => (id === 'b' ? undefined : real.sector(id)),
      edge: (edge) => (edge.sector.id === 'b' ? undefined : real.edge(edge)),
    }
    const mesh = meshOf(data, blind)
    // From a, east through the portal: b's east wall at x = 14, which is solid and back to back with c's west wall.
    const camera: Camera3D = { ...standing(90 * DEGREES) }
    const hit = pickAt(mesh, camera)
    expect(hit).toMatchObject({ sector: 'b', role: 'wall' })
    expect(hit?.selection).toBeUndefined()
    expect(hit?.distance).toBeCloseTo(10, 9)
    // With b selectable it is a selectable hit at the same place.
    expect(pickAt(meshOf(data), camera)).toMatchObject({ sector: 'b', selection: 'wall:b/1' })
  })

  it('gives nothing for a ray into the sky, or away from the level', () => {
    const mesh = meshOf(room())
    expect(pickMesh(mesh, { origin: [4, 10, 3], direction: [0, 1, 0] })).toBeUndefined()
    expect(pickMesh(mesh, { origin: [4, 10, 3], direction: [1, 0, 0] })).toBeUndefined()
    expect(pickMesh(mesh, { origin: [4, 10, 3], direction: [0, -1, 0] })).toMatchObject({ role: 'floor' })
    expect(
      pickMesh({ surfaces: [], bounds: mesh.bounds }, { origin: [0, 0, 0], direction: [0, 0, -1] }),
    ).toBeUndefined()
  })

  it('gives nothing for a ray with no direction, and does not mind a direction that is not a unit vector', () => {
    const mesh = meshOf(room())
    expect(pickMesh(mesh, { origin: [4, 1.6, 3], direction: [0, 0, 0] })).toBeUndefined()
    const unit = pickMesh(mesh, { origin: [4, 1.6, 3], direction: [0, 0, -1] })
    const long = pickMesh(mesh, { origin: [4, 1.6, 3], direction: [0, 0, -7] })
    expect(long).toEqual(unit)
    expect(long?.distance).toBeCloseTo(3, 9)
  })

  it('does not hit what is behind the eye', () => {
    const mesh = meshOf(room())
    const hit = pickMesh(mesh, { origin: [4, 1.6, 3], direction: [0, 1, 0] })
    expect(hit).toMatchObject({ role: 'ceiling' })
    expect(hit?.distance).toBeCloseTo(2.4, 9)
  })

  it('does not hit a surface the ray runs along', () => {
    const mesh = meshOf(room())
    // Level with the eye along x at z = 3: the north and south walls are parallel to it, and the east wall is hit.
    const hit = pickMesh(mesh, { origin: [4, 1.6, 3], direction: [1, 0, 0] })
    expect(hit).toMatchObject({ selection: 'wall:room/1' })
    expect(hit?.distance).toBeCloseTo(4, 9)
    // In the plane of the floor itself.
    expect(pickMesh(mesh, { origin: [4, 0, 3], direction: [0, 0, -1] })).toMatchObject({
      selection: 'wall:room/0',
    })
  })

  it('hits a wall on the diagonal of its two triangles, and on the seam between two rectangles', () => {
    const mesh = meshOf(room({ 0: { door: { at: 4, width: 2, height: 2 } } }))
    // The north wall's rectangles meet at x = 3 and x = 5: straight at that seam, and at the corner.
    expect(pickMesh(mesh, { origin: [3, 1, 3], direction: [0, 0, -1] })).toBeDefined()
    expect(pickMesh(mesh, { origin: [5, 3, 3], direction: [0, 0, -1] })).toMatchObject({ role: 'wall' })
    const plain = meshOf(room())
    // The diagonal of the north wall runs from (0, 0) to (8, 4): the point (4, 2) is on it.
    expect(pickMesh(plain, { origin: [4, 2, 3], direction: [0, 0, -1] })).toMatchObject({
      selection: 'wall:room/0',
    })
    expect(pickMesh(plain, { origin: [0, 0, 3], direction: [0, 0, -1] })).toBeDefined()
    expect(pickMesh(plain, { origin: [0, 4, 3], direction: [0, 0, -1] })).toBeDefined()
  })

  it('leaves no cracks along the diagonal of a wall, where its two triangles meet', () => {
    const mesh = meshOf(room())
    let state = 17
    const next = (): number => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0
      return state / 4294967296
    }
    // The north wall's diagonal runs from (0, 0) to (8, 4); a ray from anywhere in the room through a point of it hits the wall.
    for (let k = 0; k < 3000; k++) {
      const along = next()
      const point: Vec3 = [8 * along, 4 * along, 0]
      const origin: Vec3 = [next() * 8, next() * 3.5 + 0.2, 1 + next() * 5]
      const hit = pickMesh(mesh, { origin, direction: sub(point, origin) })
      expect(hit?.selection).toBe('wall:room/0')
    }
  })

  it('misses a wall a millimetre past its end', () => {
    const mesh = meshOf(room())
    expect(pickMesh(mesh, { origin: [-0.001, 1.6, 3], direction: [0, 0, -1] })).toBeUndefined()
    expect(pickMesh(mesh, { origin: [8.001, 1.6, 3], direction: [0, 0, -1] })).toBeUndefined()
    expect(pickMesh(mesh, { origin: [4, 4.001, 3], direction: [0, 0, -1] })).toBeUndefined()
    expect(pickMesh(mesh, { origin: [4, -0.001, 3], direction: [0, 0, -1] })).toBeUndefined()
  })

  it('hits a surface whose triangles wind the other way from its normal', () => {
    const mesh = meshOf(room())
    const flipped = {
      ...mesh,
      surfaces: mesh.surfaces.map((surface) => ({
        ...surface,
        indices: surface.indices.map((_, k, all) => all[k - (k % 3) + ((3 - (k % 3)) % 3)] as number),
      })),
    }
    const ray = { origin: [4, 1.6, 3] as Vec3, direction: [0, 0, -1] as Vec3 }
    expect(pickMesh(flipped, ray)).toEqual(pickMesh(mesh, ray))
    expect(pickMesh(flipped, ray)).toMatchObject({ selection: 'wall:room/0' })
  })

  it('takes the nearest of two surfaces whatever order they are in, and the first of two the same distance away', () => {
    const mesh = meshOf(room())
    const ray = { origin: [4, 1.6, 3] as Vec3, direction: [0.3, -0.8, -1] as Vec3 }
    const hit = pickMesh(mesh, ray)
    expect(pickMesh({ ...mesh, surfaces: [...mesh.surfaces].reverse() }, ray)?.distance).toBeCloseTo(
      hit?.distance ?? 0,
      12,
    )
    expect(hit?.role).toBe('floor')
    const [first] = mesh.surfaces as [Surface]
    const twin: Surface = { ...first, sector: 'twin' }
    const down = { origin: [4, 1.6, 3] as Vec3, direction: [0, -1, 0] as Vec3 }
    expect(pickMesh({ ...mesh, surfaces: [first, twin] }, down)?.sector).toBe('room')
    expect(pickMesh({ ...mesh, surfaces: [twin, first] }, down)?.sector).toBe('twin')
  })

  it('names the surface by its place in the mesh', () => {
    const mesh = meshOf(room())
    const hit = pickMesh(mesh, { origin: [4, 1.6, 3], direction: [0, -1, 0] })
    expect(hit?.index).toBe(0)
    expect(pickMesh(mesh, { origin: [4, 1.6, 3], direction: [0, 0, 1] })?.index).toBe(4)
  })
})

describe('pickMesh and the cameras', () => {
  const level = toyAfSector()
  const layers = afSectorProfile.geometry(level).layers
  const select = selectionOf(afSectorProfile, level)
  const mesh = buildSectorMesh(layers, select)

  /** A small deterministic generator, so a failure names the seed that made it. */
  const random = (seed: number) => {
    let state = seed
    return () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0
      return state / 4294967296
    }
  }

  const cameras = (): Camera3D[] => {
    const next = random(21)
    const orbits = [0, 45, 90, 135, 180, 225, 270, 315].map((heading) =>
      orbitCamera(fitOrbit(mesh.bounds, SIZE, { yaw: heading * DEGREES })),
    )
    const walks = Array.from({ length: 6 }, () =>
      walkCamera({ x: next() * 14, z: next() * 6 }, 0, next() * 6.28),
    )
    return [...orbits, ...walks]
  }

  it('hits where the picked pixel is drawn, from the dollhouse and from Walk alike', () => {
    const next = random(8)
    let hits = 0
    for (const camera of cameras()) {
      for (let k = 0; k < 40; k++) {
        const pixel = { x: next() * SIZE.w, y: next() * SIZE.h }
        const hit = pickAt(mesh, camera, pixel)
        if (hit === undefined) continue
        hits++
        const back = projectPoint(camera, SIZE, hit.point)
        expect(back?.x).toBeCloseTo(pixel.x, 5)
        expect(back?.y).toBeCloseTo(pixel.y, 5)
        expect(length(sub(hit.point, camera.eye))).toBeCloseTo(hit.distance, 7)
        const surface = mesh.surfaces[hit.index] as Surface
        expect(facesEye(surface, camera.eye)).toBe(true)
        expect(
          dot(
            sub(hit.point, [
              surface.positions[0] as number,
              surface.positions[1] as number,
              surface.positions[2] as number,
            ]),
            surface.normal,
          ),
        ).toBeCloseTo(0, 6)
        expect(hit.sector).toBe(surface.sector)
        expect(hit.selection).toBe(surface.selection)
        expect(hit.role).toBe(surface.role)
      }
    }
    expect(hits).toBeGreaterThan(200)
  })

  it('hits the same thing whatever order the surfaces are in', () => {
    const next = random(33)
    const shuffled = { ...mesh, surfaces: [...mesh.surfaces].sort(() => next() - 0.5) }
    for (const camera of cameras()) {
      for (let k = 0; k < 10; k++) {
        const pixel = { x: next() * SIZE.w, y: next() * SIZE.h }
        const [a, b] = [pickAt(mesh, camera, pixel), pickAt(shuffled, camera, pixel)]
        expect(b === undefined).toBe(a === undefined)
        if (a !== undefined) expect(b?.distance).toBeCloseTo(a.distance, 9)
      }
    }
  })
})

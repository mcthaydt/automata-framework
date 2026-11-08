// The 3D camera (ED3D.4 step 7, ED3D spec §5.4 and ED3D-D8): projection and picking rays, the dollhouse's orbit and the
// walk start. Axes are the plan's: x east, z south, y up. A heading (`yaw`) is a compass bearing in radians, 0 looking
// north (-z) and a quarter turn looking east (+x); `pitch` is the angle the camera looks above the horizon.

import type { AfSector } from '@automata/3d/level'
import { insideSector } from '@automata/3d/level'
import { describe, expect, it } from 'vitest'
import {
  type Camera3D,
  clipToNear,
  fitOrbit,
  forward,
  ORBIT_FOV,
  orbitBy,
  orbitCamera,
  projectPoint,
  rayThrough,
  walkCamera,
  walkStart,
} from '#src/shared/geometry/camera-3d.ts'
import type { Box3, Vec3 } from '#src/shared/geometry/sector-mesh.ts'
import type { Sector } from '#src/shared/geometry/sectors.ts'
import { cross, dot, length, sub } from '#src/shared/geometry/vec3.ts'
import { afSectorProfile } from '#src/shared/level-session/af-sector-profile.ts'
import { WALK_EYE_HEIGHT, WALK_FOV } from '#src/shared/level-session/level-hints.ts'
import type { GeometryLayer } from '#src/shared/level-session/level-profile.ts'
import { toyAfSector, toyDock, toyHall } from '#src/testing/toy-af-sector.ts'

const DEGREES = Math.PI / 180
const SIZE = { w: 800, h: 600 }

const camera = (eye: Vec3, yaw = 0, pitch = 0, fov = ORBIT_FOV): Camera3D => ({ eye, yaw, pitch, fov })

const expectVec = (actual: readonly number[], expected: readonly number[], digits = 9): void => {
  expect(actual).toHaveLength(3)
  expected.forEach((value, k) => {
    expect(actual[k] as number).toBeCloseTo(value, digits)
  })
}

/** A small deterministic generator, so a failure names the seed that made it. */
const random = (seed: number) => {
  let state = seed
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

describe('the lenses', () => {
  it('has the dollhouse look through a 24 mm lens and Walk through 69 degrees, both as the vertical field', () => {
    expect(ORBIT_FOV / DEGREES).toBeCloseTo(53.130102354, 6)
    expect(WALK_FOV / DEGREES).toBeCloseTo(69, 12)
    expect(WALK_EYE_HEIGHT).toBe(1.6)
  })
})

describe('forward', () => {
  it('looks north at heading 0, east at a quarter turn, south at a half and west at three quarters', () => {
    expectVec(forward(camera([0, 0, 0], 0)), [0, 0, -1])
    expectVec(forward(camera([0, 0, 0], 90 * DEGREES)), [1, 0, 0])
    expectVec(forward(camera([0, 0, 0], 180 * DEGREES)), [0, 0, 1])
    expectVec(forward(camera([0, 0, 0], 270 * DEGREES)), [-1, 0, 0])
  })

  it('looks up by the pitch, and is a unit vector at any angles', () => {
    expectVec(forward(camera([0, 0, 0], 0, 30 * DEGREES)), [0, 0.5, -Math.cos(30 * DEGREES)])
    expectVec(forward(camera([0, 0, 0], 0, -90 * DEGREES)), [0, -1, 0])
    const next = random(3)
    for (let k = 0; k < 50; k++) {
      const [yaw, pitch] = [next() * 7 - 3, next() * 3 - 1.5]
      expect(length(forward(camera([0, 0, 0], yaw, pitch)))).toBeCloseTo(1, 12)
    }
  })
})

describe('projectPoint', () => {
  const eye = camera([0, 0, 10])

  it('puts the point ahead on the centre, a point to the right to the right and one above above', () => {
    expect(projectPoint(eye, SIZE, [0, 0, 0])).toEqual({ x: 400, y: 300, depth: 10 })
    const right = projectPoint(eye, SIZE, [1, 0, 0])
    expect(right?.x).toBeGreaterThan(400)
    expect(right?.y).toBeCloseTo(300, 9)
    const above = projectPoint(eye, SIZE, [0, 1, 0])
    expect(above?.y).toBeLessThan(300)
    expect(above?.x).toBeCloseTo(400, 9)
  })

  it('scales by the focal length: the same offset is half as far from the centre at twice the depth', () => {
    const near = projectPoint(eye, SIZE, [1, 0, 5])
    const far = projectPoint(eye, SIZE, [1, 0, 0])
    expect(((near?.x ?? 0) - 400) / ((far?.x ?? 0) - 400)).toBeCloseTo(2, 9)
    expect(near?.depth).toBe(5)
  })

  it('gives nothing for a point behind the eye, or level with it', () => {
    expect(projectPoint(eye, SIZE, [0, 0, 11])).toBeUndefined()
    expect(projectPoint(eye, SIZE, [3, 3, 10])).toBeUndefined()
    expect(projectPoint(eye, SIZE, [0, 0, 10.0001])).toBeUndefined()
    expect(projectPoint(eye, SIZE, [0, 0, 9.9999])).toBeDefined()
  })

  it('lands a point at the edge of the vertical field on the top or bottom of the screen, for either lens', () => {
    for (const fov of [ORBIT_FOV, WALK_FOV]) {
      const lens = camera([0, 0, 10], 0, 0, fov)
      const reach = 10 * Math.tan(fov / 2)
      expect(projectPoint(lens, SIZE, [0, reach, 0])?.y).toBeCloseTo(0, 9)
      expect(projectPoint(lens, SIZE, [0, -reach, 0])?.y).toBeCloseTo(600, 9)
      // The horizontal field follows from the aspect: 4 to 3.
      expect(projectPoint(lens, SIZE, [(reach * 4) / 3, 0, 0])?.x).toBeCloseTo(800, 9)
      expect(projectPoint(lens, SIZE, [-(reach * 4) / 3, 0, 0])?.x).toBeCloseTo(0, 9)
    }
  })

  it('turns with the heading: looking east, a point to the south is to the right', () => {
    const looking = camera([0, 0, 0], 90 * DEGREES)
    const south = projectPoint(looking, SIZE, [10, 0, 1])
    expect(south?.x).toBeGreaterThan(400)
    expect(projectPoint(looking, SIZE, [10, 0, -1])?.x).toBeLessThan(400)
    const ahead = projectPoint(looking, SIZE, [10, 0, 0])
    expect(ahead?.x).toBeCloseTo(400, 9)
    expect(ahead?.y).toBeCloseTo(300, 9)
    expect(ahead?.depth).toBeCloseTo(10, 9)
  })

  it('tilts with the pitch: a point along the look direction is on the centre', () => {
    const looking = camera([2, 3, 4], 0.7, 0.4)
    const ahead = forward(looking)
    const point: Vec3 = [2 + ahead[0] * 6, 3 + ahead[1] * 6, 4 + ahead[2] * 6]
    const hit = projectPoint(looking, SIZE, point)
    expect(hit?.x).toBeCloseTo(400, 9)
    expect(hit?.y).toBeCloseTo(300, 9)
    expect(hit?.depth).toBeCloseTo(6, 9)
    // Looking up, a point on the horizon ahead is below the centre.
    expect(projectPoint(camera([0, 0, 0], 0, 0.4), SIZE, [0, 0, -10])?.y).toBeGreaterThan(300)
  })

  it('measures the screen from its own size: the centre of a canvas of any shape', () => {
    expect(projectPoint(eye, { w: 390, h: 844 }, [0, 0, 0])).toEqual({ x: 195, y: 422, depth: 10 })
  })
})

describe('rayThrough', () => {
  it('starts at the eye, and the ray through the centre of the screen is the forward vector', () => {
    const looking = camera([1, 2, 3], 0.3, -0.2)
    const ray = rayThrough(looking, SIZE, { x: 400, y: 300 })
    expect(ray.origin).toEqual([1, 2, 3])
    expectVec(ray.direction, forward(looking))
  })

  it('is a unit vector, and the pixel at the top of the screen looks up by half the field', () => {
    const lens = camera([0, 0, 0], 0, 0, WALK_FOV)
    const top = rayThrough(lens, SIZE, { x: 400, y: 0 })
    expect(length(top.direction)).toBeCloseTo(1, 12)
    expect(Math.asin(top.direction[1]) / DEGREES).toBeCloseTo(34.5, 9)
    const right = rayThrough(camera([0, 0, 0]), SIZE, { x: 800, y: 300 })
    expect(right.direction[0]).toBeGreaterThan(0)
    expect(right.direction[2]).toBeLessThan(0)
  })

  it('is the inverse of projectPoint: the ray through a point’s pixel passes through the point', () => {
    const next = random(11)
    for (let k = 0; k < 100; k++) {
      const looking = camera(
        [next() * 20 - 10, next() * 6, next() * 20 - 10],
        next() * 6.28,
        next() * 2 - 1,
        k % 2 === 0 ? WALK_FOV : ORBIT_FOV,
      )
      const point: Vec3 = [next() * 30 - 15, next() * 8 - 2, next() * 30 - 15]
      const hit = projectPoint(looking, SIZE, point)
      if (hit === undefined) continue
      const ray = rayThrough(looking, SIZE, hit)
      const toPoint = sub(point, looking.eye)
      expect(length(cross(toPoint, ray.direction))).toBeCloseTo(0, 7)
      expect(dot(toPoint, ray.direction)).toBeGreaterThan(0)
    }
  })

  it('reads the canvas size the pixel was taken on', () => {
    const phone = { w: 390, h: 844 }
    expectVec(rayThrough(camera([0, 0, 0]), phone, { x: 195, y: 422 }).direction, [0, 0, -1])
    const right = rayThrough(camera([0, 0, 0]), phone, { x: 390, y: 422 })
    const wide = rayThrough(camera([0, 0, 0]), SIZE, { x: 800, y: 300 })
    // The vertical field is the same, so a portrait screen is narrower and its edge ray leans less.
    expect(right.direction[0]).toBeLessThan(wide.direction[0])
  })
})

describe('orbitCamera', () => {
  const target: Vec3 = [4, 1, 3]

  it('sits on the sphere of the distance round the target, 30 degrees above it by default, at heading 45', () => {
    const orbit = { target, distance: 20, yaw: 45 * DEGREES, pitch: 30 * DEGREES }
    const view = orbitCamera(orbit)
    expect(length(sub(view.eye, target))).toBeCloseTo(20, 9)
    expect((view.eye[1] - target[1]) / 20).toBeCloseTo(0.5, 9)
    // It looks north-east, so it stands to the south-west of the target.
    expect(view.eye[0]).toBeLessThan(target[0])
    expect(view.eye[2]).toBeGreaterThan(target[2])
    expect(view.yaw).toBe(45 * DEGREES)
    expect(view.pitch).toBeCloseTo(-30 * DEGREES, 12)
    expect(view.fov).toBe(ORBIT_FOV)
  })

  it('looks at the target: it projects to the centre of the screen, whatever the angles', () => {
    const next = random(5)
    for (let k = 0; k < 30; k++) {
      const orbit = { target, distance: 3 + next() * 30, yaw: next() * 7, pitch: (5 + next() * 80) * DEGREES }
      const hit = projectPoint(orbitCamera(orbit), SIZE, target)
      expect(hit?.x).toBeCloseTo(400, 7)
      expect(hit?.y).toBeCloseTo(300, 7)
      expect(hit?.depth).toBeCloseTo(orbit.distance, 9)
    }
  })

  it('stands over the target at the top of the pitch, and at its horizon at 0', () => {
    expectVec(orbitCamera({ target, distance: 10, yaw: 0, pitch: 90 * DEGREES }).eye, [4, 11, 3])
    expectVec(orbitCamera({ target, distance: 10, yaw: 0, pitch: 0 }).eye, [4, 1, 13])
    expectVec(orbitCamera({ target, distance: 10, yaw: 90 * DEGREES, pitch: 0 }).eye, [-6, 1, 3])
  })

  it('takes the lens it is given', () => {
    expect(orbitCamera({ target, distance: 10, yaw: 0, pitch: 0.5 }, WALK_FOV).fov).toBe(WALK_FOV)
  })
})

describe('orbitBy', () => {
  const orbit = { target: [0, 0, 0] as Vec3, distance: 12, yaw: 45 * DEGREES, pitch: 30 * DEGREES }

  it('turns the heading freely, and brings it back into one turn', () => {
    expect(orbitBy(orbit, 90 * DEGREES, 0).yaw).toBeCloseTo(135 * DEGREES, 12)
    expect(orbitBy(orbit, 350 * DEGREES, 0).yaw).toBeCloseTo(35 * DEGREES, 12)
    expect(orbitBy(orbit, -100 * DEGREES, 0).yaw).toBeCloseTo(305 * DEGREES, 12)
    expect(orbitBy(orbit, 720 * DEGREES, 0).yaw).toBeCloseTo(45 * DEGREES, 9)
    expect(orbitBy(orbit, 0, 0)).toEqual(orbit)
  })

  it('tips the pitch and holds it between 5 and 85 degrees', () => {
    expect(orbitBy(orbit, 0, 10 * DEGREES).pitch).toBeCloseTo(40 * DEGREES, 12)
    expect(orbitBy(orbit, 0, 80 * DEGREES).pitch).toBe(85 * DEGREES)
    expect(orbitBy(orbit, 0, -80 * DEGREES).pitch).toBe(5 * DEGREES)
    expect(orbitBy(orbit, 0, 55 * DEGREES).pitch).toBe(85 * DEGREES)
    expect(orbitBy(orbit, 0, -25 * DEGREES).pitch).toBe(5 * DEGREES)
  })

  it('leaves the target and the distance alone', () => {
    expect(orbitBy(orbit, 1, 0.1)).toMatchObject({ target: orbit.target, distance: 12 })
  })
})

describe('fitOrbit', () => {
  const corners = (box: Box3): Vec3[] =>
    [box.min[0], box.max[0]].flatMap((x) =>
      [box.min[1], box.max[1]].flatMap((y) => [box.min[2], box.max[2]].map((z): Vec3 => [x, y, z])),
    )

  /** The largest part of the way from the centre of the screen to its padded edge that a corner goes. */
  const reach = (box: Box3, size: { w: number; h: number }, padding: number): number => {
    const view = orbitCamera(fitOrbit(box, size, { padding }))
    return Math.max(
      ...corners(box).map((corner) => {
        const hit = projectPoint(view, size, corner)
        if (hit === undefined) return Infinity
        return Math.max(
          Math.abs(hit.x - size.w / 2) / (size.w / 2 - padding),
          Math.abs(hit.y - size.h / 2) / (size.h / 2 - padding),
        )
      }),
    )
  }

  const hall: Box3 = { min: [0, -0.5, 0], max: [14, 4, 6] }

  it('looks at the middle of the box from the default angles', () => {
    const orbit = fitOrbit(hall, SIZE)
    expect(orbit.target).toEqual([7, 1.75, 3])
    expect(orbit.yaw).toBe(45 * DEGREES)
    expect(orbit.pitch).toBe(30 * DEGREES)
  })

  it('stands as near as it can with all eight corners on the screen, inside the padding', () => {
    for (const size of [SIZE, { w: 390, h: 844 }, { w: 1194, h: 834 }, { w: 300, h: 300 }]) {
      for (const padding of [0, 24, 60]) expect(reach(hall, size, padding)).toBeCloseTo(1, 9)
    }
  })

  it('fits a tall box, a wide one and a flat one', () => {
    for (const box of [
      { min: [0, 0, 0], max: [2, 30, 2] },
      { min: [-40, 0, -3], max: [40, 3, 3] },
      { min: [0, 0, 0], max: [10, 0.1, 10] },
    ] as Box3[])
      expect(reach(box, SIZE, 24)).toBeCloseTo(1, 9)
  })

  it('stands further off for a bigger box, and for a bigger padding', () => {
    const small: Box3 = { min: [0, 0, 0], max: [4, 3, 4] }
    const big: Box3 = { min: [0, 0, 0], max: [40, 30, 40] }
    expect(fitOrbit(big, SIZE).distance).toBeGreaterThan(fitOrbit(small, SIZE).distance)
    expect(fitOrbit(hall, SIZE, { padding: 80 }).distance).toBeGreaterThan(
      fitOrbit(hall, SIZE, { padding: 0 }).distance,
    )
  })

  it('pads 24 pixels unless told otherwise', () => {
    expect(fitOrbit(hall, SIZE).distance).toBe(fitOrbit(hall, SIZE, { padding: 24 }).distance)
  })

  it('takes the angles it is given, and the lens', () => {
    const orbit = fitOrbit(hall, SIZE, { yaw: 1, pitch: 0.7, fov: WALK_FOV })
    expect(orbit).toMatchObject({ yaw: 1, pitch: 0.7 })
    const view = orbitCamera(orbit, WALK_FOV)
    for (const corner of corners(hall)) expect(projectPoint(view, SIZE, corner)).toBeDefined()
    expect(fitOrbit(hall, SIZE, { fov: WALK_FOV }).distance).toBeLessThan(fitOrbit(hall, SIZE).distance)
  })

  it('still gives a distance when the padding is more than the canvas has', () => {
    const squeezed = fitOrbit(hall, SIZE, { padding: 5000 })
    expect(Number.isFinite(squeezed.distance)).toBe(true)
    expect(squeezed.distance).toBeGreaterThan(fitOrbit(hall, SIZE, { padding: 200 }).distance)
  })

  it('keeps a point, or a box with no size, at least a metre off', () => {
    const point: Box3 = { min: [2, 2, 2], max: [2, 2, 2] }
    expect(fitOrbit(point, SIZE).distance).toBe(1)
    expect(fitOrbit(point, SIZE).target).toEqual([2, 2, 2])
  })

  it('frames an empty level’s default box and a mesh’s bounds the same way', () => {
    expect(reach({ min: [-5, 0, -5], max: [5, 3, 5] }, SIZE, 24)).toBeCloseTo(1, 9)
  })
})

describe('walkCamera', () => {
  it('puts the eye 1.6 m above the floor at the point, looking along the heading level, through 69 degrees', () => {
    expect(walkCamera({ x: 2, z: 5 }, 0.5, 1.2)).toEqual({
      eye: [2, 0.5 + 1.6, 5],
      yaw: 1.2,
      pitch: 0,
      fov: WALK_FOV,
    })
  })

  it('takes the eye height and the lens a profile asks for', () => {
    expect(walkCamera({ x: 0, z: 0 }, -0.5, 0, { eyeHeight: 1.2, fov: 1 })).toEqual({
      eye: [0, 0.7, 0],
      yaw: 0,
      pitch: 0,
      fov: 1,
    })
  })
})

describe('walkStart', () => {
  const layersOf = (level: AfSector): readonly GeometryLayer[] => afSectorProfile.geometry(level).layers

  it('starts at the spawn, facing as it faces, at eye height over the floor it stands on', () => {
    const start = walkStart(layersOf(toyAfSector()), { x: 3, z: 2, facing: 0 })
    expect(start).toEqual({ camera: walkCamera({ x: 3, z: 2 }, 0, Math.PI) })
    expect(start).not.toHaveProperty('warning')
    // Last Light's facing 0 looks south and a quarter turn looks east; a heading 0 looks north.
    expectVec(forward(start.camera), [0, 0, 1])
    const east = walkStart(layersOf(toyAfSector()), { x: 3, z: 2, facing: Math.PI / 2 })
    expectVec(forward(east.camera), [1, 0, 0])
    const north = walkStart(layersOf(toyAfSector()), { x: 3, z: 2, facing: Math.PI })
    expectVec(forward(north.camera), [0, 0, -1])
  })

  it('stands on the floor of the room the spawn is in', () => {
    const dock = walkStart(layersOf(toyAfSector()), { x: 10, z: 3, facing: 0 })
    expect(dock.camera.eye).toEqual([10, -0.5 + 1.6, 3])
    expect(walkStart(layersOf(toyAfSector()), { x: 40, z: 40, facing: 0 }).camera.eye).toEqual([40, 1.6, 40])
  })

  it('takes the eye height a profile asks for', () => {
    const start = walkStart(layersOf(toyAfSector()), { x: 3, z: 2, facing: 0 }, { eyeHeight: 1.2 })
    expect(start.camera.eye).toEqual([3, 1.2, 2])
  })

  it('starts in the middle of the first sector, with a warning, when the level has no spawn', () => {
    const start = walkStart(layersOf(toyAfSector()), undefined)
    expectVec(start.camera.eye, [4, 1.6, 3])
    expect(start.camera).toMatchObject({ yaw: 0, pitch: 0, fov: WALK_FOV })
    expect(start.warning).toBe('This level has no spawn, so Walk starts in the middle of the sector hall.')
    // The first sector of the first layer, and its own floor.
    const raised = walkStart(
      layersOf(toyAfSector({ sectors: [{ ...toyDock, floor: 2 }, toyHall] })),
      undefined,
    )
    expectVec(raised.camera.eye, [11, 3.6, 3])
    expect(raised.warning).toContain('the sector dock')
  })

  it('starts inside a sector whose middle is not in it: a bend, and a room with a hole in the middle', () => {
    const outline = (id: string, corners: readonly (readonly [number, number])[], holes = []) =>
      toyAfSector({ sectors: [{ ...toyHall, id, corners, ...(holes.length > 0 ? { holes } : {}) }] })
    const crook = outline('crook', [
      [0, 0],
      [10, 0],
      [10, 2],
      [2, 2],
      [2, 10],
      [0, 10],
    ])
    const ring = toyAfSector({
      sectors: [
        {
          ...toyHall,
          id: 'ring',
          corners: [
            [0, 0],
            [8, 0],
            [8, 8],
            [0, 8],
          ],
          holes: [
            [
              [2, 2],
              [6, 2],
              [6, 6],
              [2, 6],
            ],
          ],
        },
      ],
    })
    // The U is the one whose first triangle is not its biggest, and whose biggest is one of three of the same size: the
    // first of them is taken.
    const u = outline('u', [
      [6, 3],
      [3, 3],
      [3, 9],
      [0, 9],
      [0, 0],
      [9, 0],
      [9, 9],
      [6, 9],
    ])
    // Each is the middle of the biggest triangle of the floor: the long arm of the bend, the left strip of the ring, the
    // left arm of the U.
    const expected: [AfSector, number[]][] = [
      [crook, [20 / 3, 1.6, 2 / 3]],
      [ring, [2 / 3, 1.6, 10 / 3]],
      [u, [1, 1.6, 4]],
    ]
    for (const [level, eye] of expected) {
      const layers = layersOf(level)
      const sector = layers[0]?.map.sectors[0] as Sector
      const start = walkStart(layers, undefined).camera.eye
      expect(insideSector({ x: start[0], z: start[2] }, sector)).toBe(true)
      expectVec(start, eye)
    }
  })

  it('reads the layers in order: the spawn’s room and the first sector may be in a later one', () => {
    const none = layersOf(toyAfSector({ sectors: [] }))
    const toy = layersOf(toyAfSector())
    expect(walkStart([...none, ...toy], { x: 10, z: 3, facing: 0 }).camera.eye).toEqual([10, 1.1, 3])
    expect(walkStart([...none, ...toy], undefined).warning).toContain('the sector hall')
  })

  it('starts at the origin of a sector that has no corners, on its floor', () => {
    const empty = toyAfSector({ sectors: [{ ...toyHall, floor: 1, corners: [] }] })
    expect(walkStart(layersOf(empty), undefined).camera.eye).toEqual([0, 2.6, 0])
  })

  it('starts at the first corner of a sector with no area', () => {
    const line = toyAfSector({
      sectors: [
        {
          ...toyHall,
          corners: [
            [3, 4],
            [5, 4],
            [7, 4],
          ],
        },
      ],
    })
    expect(walkStart(layersOf(line), undefined).camera.eye).toEqual([3, 1.6, 4])
  })

  it('starts at the origin, with a warning, when the level has no sector at all', () => {
    const start = walkStart(layersOf(toyAfSector({ sectors: [] })), undefined)
    expect(start.camera).toEqual(walkCamera({ x: 0, z: 0 }, 0, 0))
    expect(start.warning).toBe('This level has no sectors, so Walk starts at the origin.')
    expect(walkStart([], undefined).warning).toBe(start.warning)
  })

  it('uses a spawn even where there is no sector, with no warning', () => {
    const start = walkStart([], { x: 1, z: 2, facing: 0 })
    expect(start.camera.eye).toEqual([1, 1.6, 2])
    expect(start).not.toHaveProperty('warning')
  })
})

// Near-plane clipping (ED3D.8b): a first-person eye is inside the room, so its floor, ceiling and walls reach behind it;
// the part ahead of a plane just in front of the eye is what is drawn.
describe('clipToNear', () => {
  const eye: Camera3D = { eye: [0, 0, 0], yaw: 0, pitch: 0, fov: Math.PI / 3 }

  it('keeps a triangle wholly ahead as it is, each edge its own', () => {
    const clipped = clipToNear(eye, [
      [0, 0, -2],
      [1, 0, -2],
      [0, 1, -2],
    ])
    expect(clipped?.points).toEqual([
      [0, 0, -2],
      [1, 0, -2],
      [0, 1, -2],
    ])
    expect(clipped?.edge).toEqual([0, 1, 2])
  })

  it('drops a triangle wholly behind the plane', () => {
    expect(
      clipToNear(eye, [
        [0, 0, 2],
        [1, 0, 2],
        [0, 1, 2],
      ]),
    ).toBeUndefined()
  })

  it('cuts a triangle that reaches behind into a quadrilateral on the plane, with the cut edge belonging to no original edge', () => {
    const clipped = clipToNear(
      eye,
      [
        [0, 0, -2],
        [1, 0, -2],
        [0, 0, 2],
      ],
      0.1,
    )
    expect(clipped?.points).toHaveLength(4)
    for (const point of clipped?.points ?? []) expect(-point[2]).toBeGreaterThanOrEqual(0.1 - 1e-9)
    expect(clipped?.edge.filter((edge) => edge < 0)).toHaveLength(1)
  })

  it('cuts a triangle with one corner ahead into a smaller triangle', () => {
    const clipped = clipToNear(
      eye,
      [
        [0, 0, -2],
        [1, 0, 2],
        [-1, 0, 2],
      ],
      0.1,
    )
    expect(clipped?.points).toHaveLength(3)
    expect(clipped?.edge.filter((edge) => edge < 0)).toHaveLength(1)
  })
})

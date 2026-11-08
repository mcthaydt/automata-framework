// The 3D camera (ED3D.4 step 7, ED3D spec §5.4 and ED3D-D8): projection and picking rays for the dollhouse and for Walk, the
// dollhouse's orbit, and where Walk starts. Plain data and pure functions, so the views and the tests share one camera.
//
// Axes are the plan's: x east, z south, y up. A heading (`yaw`) is a compass bearing in radians: 0 looks north (-z) and a
// quarter turn looks east (+x), so the plan's north is up the screen in both. `pitch` is the angle the camera looks above
// the horizon (negative looks down). `fov` is the vertical field of view; the horizontal one follows from the canvas.

import type { Point } from '@automata/3d/level'
import { insideSector, triangulate } from '@automata/3d/level'
import type { Point as ScreenPoint, Size } from '@automata/editor/kit/core'
import { WALK_EYE_HEIGHT, WALK_FOV } from '../level-session/level-hints'
import type { GeometryLayer } from '../level-session/level-profile'
import type { Box3, Vec3 } from './sector-mesh'
import type { Sector } from './sectors'
import { add, cross, dot, scale, sub, unit } from './vec3'

const DEGREES = Math.PI / 180

/** The dollhouse's lens: 24 mm on a 24 mm tall frame (Crow Country's, ED3D spec §5.4), 53.13 degrees. */
export const ORBIT_FOV: number = 2 * Math.atan(12 / 24)

/** Where the dollhouse starts, and how far it may tip: never under the floor, never straight down. */
export const HOME_YAW: number = 45 * DEGREES
const HOME_PITCH = 30 * DEGREES
const LOWEST_PITCH = 5 * DEGREES
const HIGHEST_PITCH = 85 * DEGREES
const TURN = 2 * Math.PI

/** The nearest a framed corner may be to the eye, in metres, and the margin a framed box keeps from the canvas edge. */
const NEAREST = 1
const FIT_PADDING = 24

export interface Camera3D {
  readonly eye: Vec3
  /** Compass bearing in radians. */
  readonly yaw: number
  /** Radians above the horizon. */
  readonly pitch: number
  /** Vertical field of view in radians. */
  readonly fov: number
}

export interface Ray {
  readonly origin: Vec3
  /** Unit length. */
  readonly direction: Vec3
}

/** The camera's axes: where it looks, and its right and up. */
function basis(camera: Camera3D): { readonly ahead: Vec3; readonly right: Vec3; readonly up: Vec3 } {
  const ahead = forward(camera)
  const right: Vec3 = [Math.cos(camera.yaw), 0, Math.sin(camera.yaw)]
  return { ahead, right, up: cross(right, ahead) }
}

/** The unit vector the camera looks along. */
export function forward(camera: Camera3D): Vec3 {
  const level = Math.cos(camera.pitch)
  return [Math.sin(camera.yaw) * level, Math.sin(camera.pitch), -Math.cos(camera.yaw) * level]
}

/** How many pixels the canvas's height spans at a distance of one metre: the focal length in pixels. */
const focalLength = (camera: Camera3D, size: Size): number => size.h / 2 / Math.tan(camera.fov / 2)

/**
 * Where a point of the world falls on a canvas of `size`, in pixels from its top left, and how far ahead of the eye it
 * is in metres. Nothing for a point that is not ahead of the eye.
 */
export function projectPoint(
  camera: Camera3D,
  size: Size,
  point: Vec3,
): { readonly x: number; readonly y: number; readonly depth: number } | undefined {
  const { ahead, right, up } = basis(camera)
  const offset = sub(point, camera.eye)
  const depth = dot(offset, ahead)
  if (!(depth > 0)) return undefined
  const focal = focalLength(camera, size)
  return {
    x: size.w / 2 + (focal * dot(offset, right)) / depth,
    y: size.h / 2 - (focal * dot(offset, up)) / depth,
    depth,
  }
}

/** The nearest a first-person view draws: a plane this far ahead of the eye, in metres. */
export const NEAR = 0.05

/** A triangle cut to what is ahead of the near plane: its points, and for each segment to the next the original edge it lies on (-1 on the cut). */
export interface ClippedTriangle {
  readonly points: readonly Vec3[]
  readonly edge: readonly number[]
}

/**
 * A triangle of the world cut by the plane `near` metres ahead of the eye (Sutherland–Hodgman, one plane). A first-person
 * eye is inside a room, so the room's floor, ceiling and walls reach behind it, and a projection that drops every triangle
 * with a point behind the eye would leave the room empty. Nothing for a triangle wholly behind the plane.
 */
export function clipToNear(
  camera: Camera3D,
  triangle: readonly [Vec3, Vec3, Vec3],
  near: number = NEAR,
): ClippedTriangle | undefined {
  const { ahead } = basis(camera)
  const depths = triangle.map((point) => dot(sub(point, camera.eye), ahead))
  if (depths.every((depth) => depth >= near)) return { points: triangle, edge: [0, 1, 2] }
  if (depths.every((depth) => depth < near)) return undefined
  const points: Vec3[] = []
  const edge: number[] = []
  for (let i = 0; i < 3; i++) {
    const [a, b] = [triangle[i] as Vec3, triangle[(i + 1) % 3] as Vec3]
    const [da, db] = [depths[i] as number, depths[(i + 1) % 3] as number]
    const crossing = (da - near) * (db - near) < 0
    const at = crossing ? add(a, scale(sub(b, a), (near - da) / (db - da))) : undefined
    if (da >= near) {
      points.push(a)
      // The segment from a corner ahead lies on its own edge, to the next corner or to the cut.
      edge.push(i)
      if (at !== undefined) {
        points.push(at)
        edge.push(-1)
      }
    } else if (at !== undefined) {
      points.push(at)
      edge.push(i)
    }
  }
  return { points, edge }
}

/** The ray from the eye through a pixel of the canvas: the inverse of `projectPoint`. */
export function rayThrough(camera: Camera3D, size: Size, at: ScreenPoint): Ray {
  const { ahead, right, up } = basis(camera)
  const focal = focalLength(camera, size)
  const across = scale(right, (at.x - size.w / 2) / focal)
  const upward = scale(up, -(at.y - size.h / 2) / focal)
  return { origin: camera.eye, direction: unit(add(add(ahead, across), upward)) }
}

/** The dollhouse's state: the point it looks at, how far off it stands, and the heading and the pitch it is seen from. */
export interface Orbit {
  readonly target: Vec3
  readonly distance: number
  /** The compass bearing the camera looks along. */
  readonly yaw: number
  /** How far the camera stands above the target's horizon, in radians, from 5 to 85 degrees (not the camera's own pitch). */
  readonly pitch: number
}

/** The camera that stands `distance` from the target, up at the pitch, and looks at it. */
export function orbitCamera(orbit: Orbit, fov: number = ORBIT_FOV): Camera3D {
  const pitch = 0 - orbit.pitch
  const looking = forward({ eye: orbit.target, yaw: orbit.yaw, pitch, fov })
  return { eye: sub(orbit.target, scale(looking, orbit.distance)), yaw: orbit.yaw, pitch, fov }
}

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value))

/** The orbit turned by `yaw` radians, which comes back round (it is kept in one turn), and tipped by `pitch`, which stops at 5 and 85 degrees. */
export function orbitBy(orbit: Orbit, yaw: number, pitch: number): Orbit {
  const turned = (orbit.yaw + yaw) % TURN
  return {
    ...orbit,
    yaw: turned < 0 ? turned + TURN : turned,
    pitch: clamp(orbit.pitch + pitch, LOWEST_PITCH, HIGHEST_PITCH),
  }
}

export interface FitOptions {
  /** The margin kept from the edge of the canvas, in pixels. */
  readonly padding?: number | undefined
  readonly yaw?: number | undefined
  readonly pitch?: number | undefined
  readonly fov?: number | undefined
}

/** The corners of a box. */
const cornersOf = (box: Box3): Vec3[] =>
  [box.min[0], box.max[0]].flatMap((x) =>
    [box.min[1], box.max[1]].flatMap((y) => [box.min[2], box.max[2]].map((z): Vec3 => [x, y, z])),
  )

/**
 * The orbit that looks at the middle of the box from the dollhouse's home angles (or the ones given), from as near as lets
 * all eight corners onto a canvas of `size` inside the padding. Each corner needs a distance that puts it inside the
 * padded width and height, and the farthest of those does; no corner is ever nearer to the eye than a metre.
 */
export function fitOrbit(box: Box3, size: Size, options: FitOptions = {}): Orbit {
  const [yaw, pitch, fov] = [options.yaw ?? HOME_YAW, options.pitch ?? HOME_PITCH, options.fov ?? ORBIT_FOV]
  const target: Vec3 = [
    (box.min[0] + box.max[0]) / 2,
    (box.min[1] + box.max[1]) / 2,
    (box.min[2] + box.max[2]) / 2,
  ]
  // The camera at the target has the axes of the one that stands back from it, and a corner is `ahead` of the target by
  // the way it lies along them: standing back by `distance` puts it `distance + ahead` in front of the eye.
  const view = orbitCamera({ target, distance: 0, yaw, pitch }, fov)
  const { ahead, right, up } = basis(view)
  const padding = options.padding ?? FIT_PADDING
  const focal = focalLength(view, size)
  const [reachAcross, reachUp] = [
    Math.max(size.w / 2 - padding, 1) / focal,
    Math.max(size.h / 2 - padding, 1) / focal,
  ]
  const distance = Math.max(
    ...cornersOf(box).map((corner) => {
      const offset = sub(corner, target)
      const needed = Math.max(
        Math.abs(dot(offset, right)) / reachAcross,
        Math.abs(dot(offset, up)) / reachUp,
        NEAREST,
      )
      return needed - dot(offset, ahead)
    }),
  )
  return { target, distance, yaw, pitch }
}

export interface WalkOptions {
  /** What the profile says, else `WALK_EYE_HEIGHT` and `WALK_FOV`. */
  readonly eyeHeight?: number | undefined
  readonly fov?: number | undefined
}

/** Walk's camera at a place on the plan, standing on a floor at the height given, looking level along a heading. */
export function walkCamera(at: Point, floor: number, heading: number, options: WalkOptions = {}): Camera3D {
  return {
    eye: [at.x, floor + (options.eyeHeight ?? WALK_EYE_HEIGHT), at.z],
    yaw: heading,
    pitch: 0,
    fov: options.fov ?? WALK_FOV,
  }
}

/** A level's spawn, as Last Light and the entity definitions write it: where, and the way it faces (0 looks south). */
export interface SpawnPoint {
  readonly x: number
  readonly z: number
  readonly facing: number
}

export interface WalkStart {
  readonly camera: Camera3D
  /** What the status line says when the start is a guess. */
  readonly warning?: string
}

const ORIGIN: Point = { x: 0, z: 0 }

/** The sectors of every layer, in order. */
const sectorsOf = (layers: readonly GeometryLayer[]): Sector[] =>
  layers.flatMap((layer) => [...layer.map.sectors])

/** The middle of an outline's area, or nothing for one with no area. */
function centroid(outline: readonly Point[]): Point | undefined {
  let [twice, x, z] = [0, 0, 0]
  outline.forEach((p, k) => {
    const q = outline[(k + 1) % outline.length] as Point
    const area = p.x * q.z - q.x * p.z
    twice += area
    x += (p.x + q.x) * area
    z += (p.z + q.z) * area
  })
  return twice === 0 ? undefined : { x: x / (3 * twice), z: z / (3 * twice) }
}

/**
 * A point in the room near its middle: the middle of its outline, or when that is out of the room (a bend, a hole), the
 * middle of the biggest triangle of its floor, which is in the room by construction. A room with no area has its first corner.
 */
function middleOf(sector: Sector): Point {
  const [outline = [], ...holes] = sector.points
  const middle = centroid(outline)
  if (middle !== undefined && insideSector(middle, sector)) return middle
  const { points, triangles } = triangulate(outline, holes)
  let best: { area: number; at: Point } | undefined
  for (const triangle of triangles) {
    const [a, b, c] = triangle.map((index) => points[index] as Point) as [Point, Point, Point]
    // Twice the area; a triangle comes out of `triangulate` turning counter-clockwise, so it is positive.
    const area = (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)
    if (best === undefined || area > best.area)
      best = { area, at: { x: (a.x + b.x + c.x) / 3, z: (a.z + b.z + c.z) / 3 } }
  }
  return best?.at ?? outline[0] ?? ORIGIN
}

/**
 * Where Walk starts (ED3D spec flow 4 and ED3-n): at the spawn, facing as it faces, standing on the floor of the room it
 * is in (nothing under it is the ground at 0), or with no spawn in the middle of the first sector with a warning, or
 * with no sector at the origin with a warning. A spawn outside every room is used as it is: the `entities` check says so.
 */
export function walkStart(
  layers: readonly GeometryLayer[],
  spawn: SpawnPoint | undefined,
  options: WalkOptions = {},
): WalkStart {
  const sectors = sectorsOf(layers)
  if (spawn !== undefined) {
    const floor = sectors.find((sector) => insideSector(spawn, sector))?.floor ?? 0
    // Last Light's facing turns from south toward east; a heading turns from north toward east.
    return { camera: walkCamera(spawn, floor, Math.PI - spawn.facing, options) }
  }
  const first = sectors[0]
  if (first === undefined)
    return {
      camera: walkCamera(ORIGIN, 0, 0, options),
      warning: 'This level has no sectors, so Walk starts at the origin.',
    }
  return {
    camera: walkCamera(middleOf(first), first.floor, 0, options),
    warning: `This level has no spawn, so Walk starts in the middle of the sector ${first.id}.`,
  }
}

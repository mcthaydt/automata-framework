// Cutaway and picking in 3D (ED3D.4 step 8, ED3D spec §6 and flow 4): which surfaces an eye sees and what a ray from it hits
// first among them. A surface that faces away from the eye is cut away, so the dollhouse looks into a room through its
// near walls, and Walk, standing in a room, sees all of its walls. A cut-away surface is not hit either: the ray goes
// through it. Both views ask the same question of the same mesh, so they cannot disagree about what is under a pixel.
import type { Ray } from './camera-3d'
import type { SectorMesh, Surface, SurfaceRole, Vec3 } from './sector-mesh'
import { add, cross, dot, scale, sub, unit } from './vec3'

export interface MeshHit {
  /** The surface's place in `mesh.surfaces`. */
  readonly index: number
  readonly role: SurfaceRole
  readonly sector: string
  /** What the app selects; nothing for a surface of a sector that only the geometry has, which still stops the ray. */
  readonly selection: string | undefined
  readonly point: Vec3
  /** From the ray's origin to `point`, in metres. */
  readonly distance: number
}

/** A ray that grazes a triangle's edge counts as a hit, so the seam between two triangles is not a crack to look through. */
const TOLERANCE = 1e-9

const cornerOf = (surface: Surface, index: number): Vec3 => [
  surface.positions[3 * index] as number,
  surface.positions[3 * index + 1] as number,
  surface.positions[3 * index + 2] as number,
]

/** Whether the eye is on the side of the surface's plane that its normal points to: the side it is drawn for. */
export const facesEye = (surface: Surface, eye: Vec3): boolean =>
  dot(sub(eye, cornerOf(surface, 0)), surface.normal) > 0

/** The surfaces the eye sees, in mesh order: all but the ones cut away. */
export const visibleSurfaces = (mesh: SectorMesh, eye: Vec3): Surface[] =>
  mesh.surfaces.filter((surface) => facesEye(surface, eye))

/** How far along a ray with a unit direction the triangle is, by Möller and Trumbore; nothing for a miss or one behind. */
function distanceToTriangle(origin: Vec3, direction: Vec3, a: Vec3, b: Vec3, c: Vec3): number | undefined {
  const [edge1, edge2] = [sub(b, a), sub(c, a)]
  const p = cross(direction, edge2)
  const determinant = dot(edge1, p)
  // A ray that runs along the triangle's plane never crosses it.
  if (Math.abs(determinant) < TOLERANCE) return undefined
  const toOrigin = sub(origin, a)
  const u = dot(toOrigin, p) / determinant
  if (u < -TOLERANCE) return undefined
  const q = cross(toOrigin, edge1)
  const v = dot(direction, q) / determinant
  // `u` is at most 1 when `v` is not below 0 and the two do not add up to more than 1.
  if (v < -TOLERANCE || u + v > 1 + TOLERANCE) return undefined
  const distance = dot(edge2, q) / determinant
  return distance > TOLERANCE ? distance : undefined
}

/**
 * What the ray hits first among the surfaces its origin sees (the origin is the eye, so a wall cut away from the eye is
 * passed through). Of two the same distance away the first in the mesh. Nothing for a ray that hits none, and for one
 * with no direction (it crosses nothing).
 */
export function pickMesh(mesh: SectorMesh, ray: Ray): MeshHit | undefined {
  const direction = unit(ray.direction)
  let best: { index: number; distance: number } | undefined
  for (const [index, surface] of mesh.surfaces.entries()) {
    if (!facesEye(surface, ray.origin)) continue
    for (let k = 0; k < surface.indices.length; k += 3) {
      const [a, b, c] = [0, 1, 2].map((i) => cornerOf(surface, surface.indices[k + i] as number)) as [
        Vec3,
        Vec3,
        Vec3,
      ]
      const distance = distanceToTriangle(ray.origin, direction, a, b, c)
      if (distance !== undefined && (best === undefined || distance < best.distance))
        best = { index, distance }
    }
  }
  if (best === undefined) return undefined
  const surface = mesh.surfaces[best.index] as Surface
  return {
    index: best.index,
    role: surface.role,
    sector: surface.sector,
    selection: surface.selection,
    point: add(ray.origin, scale(direction, best.distance)),
    distance: best.distance,
  }
}

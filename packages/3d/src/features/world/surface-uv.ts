// Where a point lies on its surface, in metres: a floor or a ceiling by the world's x and z, a wall by the way it faces
// (x and y, or z and y), each in the surface's own frame when its placement names one (a wall's start, a prop's origin).
// The tile is laid on those metres by the material, which scales them by the tile's texels a metre; a placement's repeat,
// pan and turn are applied there, as the source applies them where it reads a tile (`photo/tile-store.ts`).
//
// A point's face is decided by its normal: from a slope of 0.7 up it is floor-like and takes the floor's tile pair, and
// otherwise it is a wall and takes the wall pair.

import type { MeshData } from '../../shared/math/geometry.ts'
import type { TexFrame, Vec3 } from './surface.ts'

/** The slope of a normal from which a face is a floor or a ceiling and not a wall. */
const FLOOR_SLOPE = 0.7

/** Whether a face with this normal takes the floor's pair of tile scales (and reads its rows the floor's way). */
export function isFloorLike(normal: Vec3): boolean {
  return Math.abs(normal[1]) >= FLOOR_SLOPE
}

/** Which way a face is projected: onto the ground, onto a wall that faces z, or onto one that faces x. */
type Projection = 'floor' | 'z' | 'x'

const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

function projectionOf(normal: Vec3): Projection {
  if (isFloorLike(normal)) return 'floor'
  return Math.abs(normal[2]) >= Math.abs(normal[0]) ? 'z' : 'x'
}

function uvOf(local: Vec3, projection: Projection): readonly [number, number] {
  if (projection === 'floor') return [local[0], local[2]]
  return projection === 'z' ? [local[0], local[1]] : [local[2], local[1]]
}

/** A point in a frame: the frame's origin taken off, then along its three axes. */
function toLocal(frame: TexFrame | undefined, point: Vec3): Vec3 {
  if (frame === undefined) return point
  const d: Vec3 = [point[0] - frame.o[0], point[1] - frame.o[1], point[2] - frame.o[2]]
  return [dot(d, frame.x), dot(d, frame.y), dot(d, frame.z)]
}

function directionToLocal(frame: TexFrame | undefined, normal: Vec3): Vec3 {
  return frame === undefined ? normal : [dot(normal, frame.x), dot(normal, frame.y), dot(normal, frame.z)]
}

/** A point's place on its surface, in metres along u then v. */
export function surfaceUv(
  position: Vec3,
  normal: Vec3,
  frame: TexFrame | undefined,
): readonly [number, number] {
  return uvOf(toLocal(frame, position), projectionOf(directionToLocal(frame, normal)))
}

/** A mesh with its texture coordinates (two metres a vertex) and, for each vertex, whether it is floor-like (1) or not (0). */
export interface UvMesh extends MeshData {
  readonly uvs: number[]
  readonly floor: number[]
}

/**
 * The mesh with its texture coordinates in `frame`. Each triangle is projected one way, from the mean of its vertex
 * normals, so a rounded prop never stretches a tile across a triangle whose corners disagree; a vertex that two
 * projections share is made twice, with the same position and normal, so the light stays smooth across it.
 */
export function uvMesh(mesh: MeshData, frame: TexFrame | undefined): UvMesh {
  const at = (source: readonly number[], i: number): Vec3 => [
    source[i * 3] as number,
    source[i * 3 + 1] as number,
    source[i * 3 + 2] as number,
  ]
  const count = mesh.positions.length / 3
  const positions = [...mesh.positions]
  const normals = [...mesh.normals]
  const uvs: number[] = []
  const floor: number[] = []
  const place = (corner: number, projection: Projection): void => {
    uvs.push(...uvOf(toLocal(frame, at(mesh.positions, corner)), projection))
    floor.push(projection === 'floor' ? 1 : 0)
  }
  // Vertices keep their numbers, each projected by its own normal until a triangle says otherwise.
  for (let i = 0; i < count; i++) place(i, projectionOf(directionToLocal(frame, at(mesh.normals, i))))
  const used = new Map<number, Projection>()
  const copies = new Map<string, number>()
  const indices: number[] = []
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const corners = [mesh.indices[t], mesh.indices[t + 1], mesh.indices[t + 2]] as [number, number, number]
    let [mx, my, mz] = [0, 0, 0]
    for (const corner of corners) {
      const n = at(mesh.normals, corner)
      mx += n[0]
      my += n[1]
      mz += n[2]
    }
    const projection = projectionOf(directionToLocal(frame, [mx, my, mz]))
    for (const corner of corners) {
      const first = used.get(corner)
      if (first === undefined) {
        used.set(corner, projection)
        uvs.splice(corner * 2, 2, ...uvOf(toLocal(frame, at(mesh.positions, corner)), projection))
        floor[corner] = projection === 'floor' ? 1 : 0
        indices.push(corner)
      } else if (first === projection) indices.push(corner)
      else {
        const key = `${corner}:${projection}`
        let copy = copies.get(key)
        if (copy === undefined) {
          copy = positions.length / 3
          copies.set(key, copy)
          positions.push(...at(mesh.positions, corner))
          normals.push(...at(mesh.normals, corner))
          place(corner, projection)
        }
        indices.push(copy)
      }
    }
  }
  return { positions, normals, indices, uvs, floor }
}

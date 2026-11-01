// The glowing mushroom clusters as two merged meshes (art direction spec §4.5, §4.10): every cap in one geometry and
// every stem in another, so the room's mushrooms are two draws whatever their number. A cap is a low dome (a squashed
// hemisphere, 8 sides and 3 rings), a stem a 6-sided tapered prism; three of each, in fixed offsets, make a cluster.
import { Geometry3D } from '@pixi/3d'
import type { Spot } from './dressing.ts'

/** A cluster's three mushrooms: offset from its spot in metres, and scale (1 is the largest). */
export const CLUSTER: readonly (readonly [dx: number, dz: number, scale: number])[] = [
  [0, 0, 1],
  [0.18, 0.12, 0.7],
  [-0.12, 0.16, 0.55],
]

/** The largest mushroom's sizes in metres: cap radius and height, stem height and radii. */
const CAP = { radius: 0.2, height: 0.09 } as const
const STEM = { height: 0.22, top: 0.025, bottom: 0.035 } as const
const SIDES = 8
const RINGS = 3
const STEM_SIDES = 6

export interface MeshData {
  readonly positions: Float32Array
  readonly normals: Float32Array
  readonly indices: Uint32Array
}

class Builder {
  readonly positions: number[] = []
  readonly normals: number[] = []
  readonly indices: number[] = []
  vertex(x: number, y: number, z: number, nx: number, ny: number, nz: number): number {
    const length = Math.hypot(nx, ny, nz) || 1
    this.positions.push(x, y, z)
    this.normals.push(nx / length, ny / length, nz / length)
    return this.positions.length / 3 - 1
  }
  data(): MeshData {
    return {
      positions: new Float32Array(this.positions),
      normals: new Float32Array(this.normals),
      indices: new Uint32Array(this.indices),
    }
  }
}

/** A dome over (x, base, z): rings from the rim up to a top vertex, normals of the squashed sphere. */
function dome(b: Builder, x: number, base: number, z: number, radius: number, height: number): void {
  const rings: number[][] = []
  for (let r = 0; r < RINGS; r++) {
    const phi = (r / RINGS) * (Math.PI / 2)
    const ring: number[] = []
    for (let s = 0; s < SIDES; s++) {
      const theta = (s / SIDES) * Math.PI * 2
      const [cx, sz] = [Math.cos(theta) * Math.cos(phi), Math.sin(theta) * Math.cos(phi)]
      const up = Math.sin(phi)
      // The normal of an ellipsoid with radii (radius, height, radius) at this point.
      ring.push(
        b.vertex(x + cx * radius, base + up * height, z + sz * radius, cx / radius, up / height, sz / radius),
      )
    }
    rings.push(ring)
  }
  const top = b.vertex(x, base + height, z, 0, 1, 0)
  for (let r = 0; r < RINGS - 1; r++)
    for (let s = 0; s < SIDES; s++) {
      const [a, c] = [rings[r] as number[], rings[r + 1] as number[]]
      const next = (s + 1) % SIDES
      b.indices.push(
        a[s] as number,
        c[s] as number,
        a[next] as number,
        a[next] as number,
        c[s] as number,
        c[next] as number,
      )
    }
  const last = rings[RINGS - 1] as number[]
  for (let s = 0; s < SIDES; s++) b.indices.push(last[s] as number, top, last[(s + 1) % SIDES] as number)
}

/** A tapered prism from the floor at (x, z) up `height`, its sides facing outward. */
function stem(b: Builder, x: number, z: number, height: number, top: number, bottom: number): void {
  const ring = (y: number, radius: number) =>
    Array.from({ length: STEM_SIDES }, (_, s) => {
      const theta = (s / STEM_SIDES) * Math.PI * 2
      return b.vertex(
        x + Math.cos(theta) * radius,
        y,
        z + Math.sin(theta) * radius,
        Math.cos(theta),
        0,
        Math.sin(theta),
      )
    })
  const [low, high] = [ring(0, bottom), ring(height, top)]
  for (let s = 0; s < STEM_SIDES; s++) {
    const next = (s + 1) % STEM_SIDES
    b.indices.push(
      low[s] as number,
      high[s] as number,
      low[next] as number,
      low[next] as number,
      high[s] as number,
      high[next] as number,
    )
  }
}

/** Every cluster's caps and stems as two meshes' arrays. */
export function mushroomData(spots: readonly Spot[]): { readonly caps: MeshData; readonly stems: MeshData } {
  const caps = new Builder()
  const stems = new Builder()
  for (const spot of spots)
    for (const [dx, dz, s] of CLUSTER) {
      const [x, z] = [spot.x + dx, spot.z + dz]
      stem(stems, x, z, STEM.height * s, STEM.top * s, STEM.bottom * s)
      dome(caps, x, STEM.height * s - CAP.height * s * 0.3, z, CAP.radius * s, CAP.height * s)
    }
  return { caps: caps.data(), stems: stems.data() }
}

/** Arrays to a geometry. */
export const geometryOf = (data: MeshData): Geometry3D => new Geometry3D(data)

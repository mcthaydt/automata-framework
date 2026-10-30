// Occlusion for the baked light: what blocks a lamp (boxes and planes), and contact darkening where surfaces meet.
// Extracted from The Last Light (`mcthaydt/PixiJS3D_Experiment_001`) at 92e6704: `src/render/indirect-light.ts`
// (`intersectsBox`, the slab test) and `src/render/occlusion.ts` (the contact terms and their constants), with its
// tests. AF's change: the source read its level's sector map and furniture list; here the occluders are the
// `SceneLighting`'s boxes and planes, so a sector wall is a plane and the darkening rules apply to any plane.
import type { OccluderBox, OccluderPlane, SceneLighting } from './scene-lighting.schema.js'

/** A point on a surface and its unit normal, in world metres. */
export interface LightSample {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly nx: number
  readonly ny: number
  readonly nz: number
}

type Occluders = Pick<SceneLighting, 'boxes' | 'planes'>
type Axes = { readonly u: readonly [number, number, number]; readonly v: readonly [number, number, number] }

// The part of a segment that counts: its ends are surfaces and lamps, which must not block themselves.
const NEAR = 0.025
const FAR = 0.975

/** The plane's in-plane axes: `u` horizontal (x for a floor or ceiling), `v` the other, both unit length. */
function planeAxes(plane: OccluderPlane): Axes {
  const [nx, ny, nz] = plane.normal
  // A floor or ceiling: u along x, v = n × u.
  if (Math.abs(ny) > 0.9) return { u: [1, 0, 0], v: [0, nz, -ny] }
  // u = up × n (horizontal, since n is not vertical); v = n × u.
  const length = Math.hypot(nz, nx)
  const u: [number, number, number] = [nz / length, 0, -nx / length]
  return { u, v: [ny * u[2] - nz * u[1], nz * u[0] - nx * u[2], nx * u[1] - ny * u[0]] }
}

const dot = (a: readonly number[], x: number, y: number, z: number): number =>
  (a[0] ?? 0) * x + (a[1] ?? 0) * y + (a[2] ?? 0) * z

/** The slab test (the source's `intersectsBox`): whether the segment's middle part passes through the box. */
function crossesBox(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  box: OccluderBox,
): boolean {
  let near = NEAR
  let far = FAR
  const slabs: readonly [number, number, number, number][] = [
    [ax, bx, box.x - box.width / 2, box.x + box.width / 2],
    [ay, by, box.y, box.y + box.height],
    [az, bz, box.z - box.depth / 2, box.z + box.depth / 2],
  ]
  for (const [from, to, low, high] of slabs) {
    const delta = to - from
    if (Math.abs(delta) < 1e-6) {
      if (from < low || from > high) return false
      continue
    }
    const a = (low - from) / delta
    const c = (high - from) / delta
    near = Math.max(near, Math.min(a, c))
    far = Math.min(far, Math.max(a, c))
    if (near > far) return false
  }
  return true
}

/** Whether the segment's middle part crosses the plane inside its rectangle, from either side. */
function crossesPlane(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  plane: OccluderPlane,
): boolean {
  const from = dot(plane.normal, ax - plane.x, ay - plane.y, az - plane.z)
  const to = dot(plane.normal, bx - plane.x, by - plane.y, bz - plane.z)
  if (from * to >= 0) return false
  const t = from / (from - to)
  if (t < NEAR || t > FAR) return false
  const { u, v } = planeAxes(plane)
  const hx = ax + (bx - ax) * t - plane.x
  const hy = ay + (by - ay) * t - plane.y
  const hz = az + (bz - az) * t - plane.z
  return Math.abs(dot(u, hx, hy, hz)) <= plane.width / 2 && Math.abs(dot(v, hx, hy, hz)) <= plane.height / 2
}

/**
 * Whether a box or plane stands between two points (a surface and a lamp). Boxes whose `id` is in `ignore` never
 * block: a broad collider must not shadow the smaller surfaces of its own mesh (the source's owner rule).
 */
export function segmentBlocked(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  occluders: Occluders,
  ignore: readonly string[] = [],
): boolean {
  for (const plane of occluders.planes) if (crossesPlane(ax, ay, az, bx, by, bz, plane)) return true
  for (const box of occluders.boxes)
    if ((box.id === undefined || !ignore.includes(box.id)) && crossesBox(ax, ay, az, bx, by, bz, box))
      return true
  return false
}

/**
 * Contact darkening, baked once per vertex (the source's `occlusion`, its rules and constants): a factor to multiply
 * light by, 1 in the open and never below 0.3.
 * - An upright plane (a wall, the source's sector wall pieces): a surface in front of it, within 0.9 m and over its
 *   rectangle (with 15 cm to spare), darkens by `k · exp(-d / 0.28)`, k by the surface's own facing: 0.38 for a floor
 *   or top, 0.3 for an upright surface (an inside corner), 0.15 for an underside. A surface lying on it is not darkened.
 * - A floor plane (facing up, the source's sector floor): an upright surface above it darkens by
 *   `0.28 · exp(-d / 0.35)`; a ceiling plane (facing down, the source's drawn ceiling) by `0.3 · exp(-d / 0.35)`.
 * - The floor round the foot of a box (the source's furniture) darkens by `0.45 · exp(-d / 0.18)` within 0.6 m of its
 *   footprint.
 */
export function contactShade(sample: LightSample, occluders: Occluders): number {
  let open = 1
  const upright = Math.abs(sample.ny) <= 0.5
  for (const plane of occluders.planes) {
    const dx = sample.x - plane.x
    const dy = sample.y - plane.y
    const dz = sample.z - plane.z
    const d = dot(plane.normal, dx, dy, dz)
    const { u, v } = planeAxes(plane)
    if (Math.abs(dot(u, dx, dy, dz)) > plane.width / 2 + 0.15) continue
    if (Math.abs(dot(v, dx, dy, dz)) > plane.height / 2 + 0.15) continue
    const ny = plane.normal[1]
    if (Math.abs(ny) > 0.5) {
      // A floor or a ceiling: only upright surfaces in front of it darken toward it.
      if (upright && d >= 0) open *= 1 - (ny > 0 ? 0.28 : 0.3) * Math.exp(-d / 0.35)
      continue
    }
    if (d < -0.02 || d > 0.9) continue
    if (d < 0.06 && dot(plane.normal, sample.nx, sample.ny, sample.nz) > 0.7) continue
    const strength = sample.ny > 0.5 ? 0.38 : upright ? 0.3 : 0.15
    open *= 1 - strength * Math.exp(-Math.max(0, d) / 0.28)
  }
  if (sample.ny > 0.5)
    for (const box of occluders.boxes) {
      if (Math.abs(sample.y - box.y) > 0.1) continue
      const dx = Math.max(0, Math.abs(sample.x - box.x) - box.width / 2)
      const dz = Math.max(0, Math.abs(sample.z - box.z) - box.depth / 2)
      const d = Math.hypot(dx, dz)
      if (d < 0.6) open *= 1 - 0.45 * Math.exp(-d / 0.18)
    }
  return Math.max(0.3, open)
}

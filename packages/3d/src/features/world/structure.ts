// What a room's structure is drawn with, beyond its faces: trim in bands (skirting, wainscot, rail, capital), a wall's
// top, a handrail on brackets, a pilaster, and the solid masses between rooms. Each is a mesh in world space and the
// name of the surface it is painted with; `build.ts` turns them into pieces. Everything reads fields `af-sector/2`
// already holds.
import type { AfWall2, Band as WallBand } from '../../shared/level/af-sector-2.schema.ts'
import type { MassDef } from '../../shared/level/sector.schema.ts'
import { type MeshData, merge } from '../../shared/math/geometry.ts'
import type { V3 } from '../../shared/math/math.ts'
import { box, quad } from './mesh.ts'
import { onWall, planeMesh, wallQuad } from './plane-mesh.ts'
import { fill, type Segment, type V2 } from './sectors.ts'

export type BandRole = 'skirting' | 'wainscot' | 'rail' | 'capital'

/** A trim's heights as one wall reads them: the wall's own over the room's. */
export interface TrimHeights {
  readonly skirting: number
  readonly wainscot: number
  readonly rail: number
  readonly capital: number
  readonly cap: boolean
}

/** How far a band stands off the face when `trimDepth` names none (metres), as the original's trim did. */
const DEPTH: Record<BandRole, number> = { skirting: 0.03, wainscot: 0.014, rail: 0.04, capital: 0.05 }
/** How tall a capital is: a moulded band high on a pilaster or a column. */
const CAPITAL_HEIGHT = 0.22

/** A trim names a wainscot or a capital: its rail is the band's thickness, not its height (see `bandsOf`). */
export const isBanded = (trim: TrimHeights): boolean => trim.wainscot > 0 || trim.capital > 0

/** One band: its height above the floor, how far it stands off the face (negative: set back), its surface. */
export interface Band {
  readonly role: BandRole
  readonly lo: number
  readonly hi: number
  readonly depth: number
  readonly surface: string
}

/**
 * The bands of a banded trim, stacked: skirting from the floor, wainscot above it up to its height, the rail on top of
 * that (its number is its thickness), and a capital high up. Each stops at `top`, the height of the face it trims
 * (a counter's front stops at the counter top).
 */
export function bandsOf(
  trim: TrimHeights,
  wall: Pick<AfWall2, 'trimTexture' | 'trimDepth'>,
  fallback: string,
  top: number,
): Band[] {
  const out: Band[] = []
  const put = (role: BandRole, lo: number, hi: number): void => {
    const clipped = Math.min(hi, top)
    if (clipped - lo > 1e-4)
      out.push({
        role,
        lo,
        hi: clipped,
        depth: wall.trimDepth?.[role] ?? DEPTH[role],
        surface: wall.trimTexture?.[role] ?? fallback,
      })
  }
  if (trim.skirting > 0) put('skirting', 0, trim.skirting)
  if (trim.wainscot > 0) put('wainscot', trim.skirting, trim.wainscot)
  if (trim.rail > 0 && trim.wainscot > 0) put('rail', trim.wainscot, trim.wainscot + trim.rail)
  if (trim.capital > 0) put('capital', trim.capital, trim.capital + CAPITAL_HEIGHT)
  return out
}

/** Where a wall stands: its two ends, the way it faces into the room, and the floor at each end. */
export interface Run {
  readonly a: V2
  readonly b: V2
  readonly n: V2
  readonly fa: number
  readonly fb: number
}

const offset = (p: V2, n: V2, d: number): V2 => [p[0] + n[0] * d, p[1] + n[1] * d]
const lerp = (a: number, b: number, u: number): number => a + (b - a) * u

/** The floor under `p`, a point on the wall: the two ends' floors, by how far along it is. */
function floorAt(run: Run, p: V2): number {
  const length = Math.hypot(run.b[0] - run.a[0], run.b[1] - run.a[1]) || 1
  const u =
    ((p[0] - run.a[0]) * (run.b[0] - run.a[0]) + (p[1] - run.a[1]) * (run.b[1] - run.a[1])) / length ** 2
  return lerp(run.fa, run.fb, u)
}

const cross = (u: V3, v: V3): V3 => [
  u[1] * v[2] - u[2] * v[1],
  u[2] * v[0] - u[0] * v[2],
  u[0] * v[1] - u[1] * v[0],
]
const dot = (u: V3, v: V3): number => u[0] * v[0] + u[1] * v[1] + u[2] * v[2]

/** A quad from `o` along `u` and `v`, facing the way `want` points (the pair is swapped when it faces the other way). */
function facing(o: V3, u: V3, v: V3, want: V3): MeshData {
  return dot(cross(u, v), want) >= 0 ? quad(o, u, v) : quad(o, v, u)
}

/** The wall's own direction (from `a` to `b`) as a 3D vector at the floor. */
const along = (p: V2, q: V2): V3 => [q[0] - p[0], 0, q[1] - p[1]]

/** One stretch of one band: front, top (or underside when set back), the underside of a rail, and its two ends. */
function bandRun(run: Run, band: Band, p: V2, q: V2): MeshData {
  const [fp, fq] = [floorAt(run, p), floorAt(run, q)]
  const n3: V3 = [run.n[0], 0, run.n[1]]
  const front = wallQuad(
    offset(p, run.n, band.depth),
    offset(q, run.n, band.depth),
    [fp + band.lo, fp + band.hi],
    [fq + band.lo, fq + band.hi],
    run.n,
  )
  const out: MeshData[] = [front]
  const out3: V3 = [n3[0] * band.depth, 0, n3[2] * band.depth]
  const span: V3 = [q[0] - p[0], fq - fp, q[1] - p[1]]
  // The top: up when the band stands proud of the wall, down when it is set back (the underside of what is above).
  out.push(facing([p[0], fp + band.hi, p[1]], span, out3, [0, band.depth > 0 ? 1 : -1, 0]))
  // A rail or a capital shows its underside too, where it overhangs.
  if ((band.role === 'rail' || band.role === 'capital') && band.depth > 0)
    out.push(facing([p[0], fp + band.lo, p[1]], span, out3, [0, -1, 0]))
  // Square ends, facing along the wall away from the run.
  const dir = along(p, q)
  for (const [at, f, sign] of [
    [p, fp, -1],
    [q, fq, 1],
  ] as const)
    out.push(
      facing([at[0], f + band.lo, at[1]], [0, band.hi - band.lo, 0], out3, [dir[0] * sign, 0, dir[2] * sign]),
    )
  return merge(...out)
}

/** The stretches of a wall from `a` to `b` left when each door (`pos` along the dominant axis, `width`) is cut out. */
export function runsAround(
  a: V2,
  b: V2,
  doors: readonly { readonly pos: number; readonly width: number }[],
  margin: number,
): [V2, V2][] {
  const horizontal = Math.abs(b[0] - a[0]) > Math.abs(b[1] - a[1])
  const axis = horizontal ? 0 : 1
  const at = (p: number): V2 => {
    const t = (p - a[axis]) / (b[axis] - a[axis])
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]
  }
  const dir = Math.sign(b[axis] - a[axis]) || 1
  const ordered = [...doors].sort((p, q) => dir * (p.pos - q.pos))
  const runs: [V2, V2][] = []
  let start = a
  for (const d of ordered) {
    runs.push([start, at(d.pos - dir * (d.width / 2 + margin))])
    start = at(d.pos + dir * (d.width / 2 + margin))
  }
  runs.push([start, b])
  return runs.filter(([p, q]) => Math.hypot(q[0] - p[0], q[1] - p[1]) > 0.02)
}

/** Each band of a banded trim as one mesh over the runs of the wall. */
export function bandMeshes(
  run: Run,
  bands: readonly Band[],
  runs: readonly (readonly [V2, V2])[],
): { readonly band: Band; readonly mesh: MeshData }[] {
  return bands.map((band) => ({
    band,
    mesh: merge(...runs.map(([p, q]) => bandRun(run, band, p, q))),
  }))
}

/** The top of a wall `thick` metres deep behind its face, at the ceiling, facing up. */
export function wallTop(run: Run, thick: number, ceilings: readonly [number, number]): MeshData {
  const back = offset(run.a, run.n, -thick)
  const span: V3 = [run.b[0] - run.a[0], ceilings[1] - ceilings[0], run.b[1] - run.a[1]]
  return facing([back[0], ceilings[0], back[1]], span, [run.n[0] * thick, 0, run.n[1] * thick], [0, 1, 0])
}

/** A box in the wall's frame (x along it from `a` towards `b`, y up from the floor, z out of the face), as a world mesh. */
function prism(
  run: Run,
  x: readonly [number, number],
  y: readonly [number, number],
  z: readonly [number, number],
): MeshData {
  // `onWall` runs its x along (n.z, −n.x); when that is the way back from `b` to `a`, x is reversed first.
  const d = along(run.a, run.b)
  const sign = run.n[1] * d[0] - run.n[0] * d[2] >= 0 ? 1 : -1
  const [x0, x1] = sign === 1 ? x : [-x[1], -x[0]]
  const mesh = box([(x0 + x1) / 2, y[0], (z[0] + z[1]) / 2], [x1 - x0, y[1] - y[0], z[1] - z[0]])
  return onWall(mesh, run.a, run.fa, run.n)
}

/** A handrail along the wall on brackets: a bar at `height` above the floor, and a bracket every metre or so. */
export function handrail(
  run: Run,
  runs: readonly (readonly [V2, V2])[],
  height: number,
): MeshData | undefined {
  const meshes: MeshData[] = []
  for (const [p, q] of runs) {
    const length = Math.hypot(q[0] - p[0], q[1] - p[1])
    if (length < 0.6) continue
    const s0 = Math.hypot(p[0] - run.a[0], p[1] - run.a[1])
    meshes.push(prism(run, [s0 + 0.15, s0 + length - 0.15], [height, height + 0.045], [0.06, 0.1]))
    const count = Math.max(1, Math.round((length - 0.3) / 1.2))
    for (let k = 0; k <= count; k++) {
      const at = s0 + 0.25 + ((length - 0.5) * k) / count
      meshes.push(prism(run, [at - 0.015, at + 0.015], [height - 0.05, height], [0, 0.08]))
    }
  }
  return meshes.length === 0 ? undefined : merge(...meshes)
}

/** A pilaster: a block from the floor to the ceiling, `width` along the wall from its start (or back from its end) and `depth` into the room. */
export function pilaster(
  run: Run,
  side: 'start' | 'end',
  [width, depth]: readonly [number, number],
  ceilings: readonly [number, number],
): MeshData {
  const length = Math.hypot(run.b[0] - run.a[0], run.b[1] - run.a[1])
  const x: [number, number] = side === 'start' ? [0, width] : [length - width, length]
  return prism(run, x, [0, Math.min(ceilings[0] - run.fa, ceilings[1] - run.fb)], [0, depth])
}

/**
 * A mass: its top at its height (facing up), and the outward face of each edge it names, from `faces.from` up to the
 * top. Which way is out comes from the polygon's winding, so either way round is read. A mass of fewer than three
 * points draws nothing.
 */
export function massMeshes(mass: MassDef):
  | {
      readonly centre: V2
      readonly top: MeshData
      readonly faces: readonly { readonly edge: number; readonly mesh: MeshData }[]
    }
  | undefined {
  const ring = mass.points.map((p): V2 => [p.x, p.z])
  if (ring.length < 3) return undefined
  const { points, triangles } = fill(ring, [])
  const top = planeMesh(points, triangles, { z: mass.top }, ring[0] as V2, false)
  let area = 0
  ring.forEach((p, i) => {
    const q = ring[(i + 1) % ring.length] as V2
    area += p[0] * q[1] - q[0] * p[1]
  })
  const winding = Math.sign(area) || 1
  const faces = (mass.faces?.edges ?? []).flatMap((edge) => {
    const a = ring[edge]
    const b = ring[(edge + 1) % ring.length]
    if (a === undefined || b === undefined) return []
    const length = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (length < 1e-6) return []
    const out: V2 = [(winding * (b[1] - a[1])) / length, (-winding * (b[0] - a[0])) / length]
    const from = mass.faces?.from ?? 0
    return [{ edge, mesh: wallQuad(a, b, [from, mass.top], [from, mass.top], out) }]
  })
  const centre: V2 = [
    ring.reduce((sum, p) => sum + p[0], 0) / ring.length,
    ring.reduce((sum, p) => sum + p[1], 0) / ring.length,
  ]
  return { centre, top, faces }
}

/** The cornice: a band under the ceiling, in its own surface; it is not broken at doors and windows. */
export function corniceOf(
  band: WallBand,
  seg: Segment,
  n: V2,
  ceilings: readonly [number, number],
): MeshData {
  return wallQuad(
    offset(seg.a, n, 0.025),
    offset(seg.b, n, 0.025),
    [ceilings[0] - band.height, ceilings[0]],
    [ceilings[1] - band.height, ceilings[1]],
    n,
  )
}

/** The segment as the occluder rule reads a wall: from `a` to `b` with the room on the left. */
export function roomOnLeft(seg: Segment, n: V2): { a: V2; b: V2 } {
  const left: V2 = [-(seg.b[1] - seg.a[1]), seg.b[0] - seg.a[0]]
  return left[0] * n[0] + left[1] * n[1] > 0 ? { a: seg.a, b: seg.b } : { a: seg.b, b: seg.a }
}

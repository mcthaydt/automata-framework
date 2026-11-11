// Interior mapping: a lit window shows a room behind its glass. The view ray through the glass at a point is traced into
// a box room behind the wall (2.6 m wide, 2.8 m high, 3 m deep, one to each cell of the wall), and the step its hit takes
// comes back: the back wall lit near the ceiling's lamp and darker down, the side walls and the floor darker, a sofa, a
// table or a floor lamp as a silhouette by the cell's seed. Ported from the source's painter (`interiorStep`); the seed's
// hash is the repo's own, so the rooms differ from the source's. The glass is drawn once as a tile (`windowTile`), seen
// at a fixed tilt into the wall, so a window keeps its room as the camera turns (a room's parallax needs a shader).
import type { MeshData } from '../../../shared/math/geometry.ts'
import { type Ladder, STEPS } from './ladder.ts'
import type { AlbedoTile } from './place.ts'

const lattice = (a: number, b: number, c: number): number => {
  let n = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1)
  n = Math.imul(n ^ (n >>> 15), 0x85ebca6b)
  n ^= n >>> 13
  return (n >>> 0) / 4294967296
}

const W = 2.6
const H = 2.8
const D = 3

type Box = readonly [number, number, number, number, number, number, number]

/**
 * The step (an offset from the swatch's base) a view ray takes through glass at world point `(px, py, pz)`, whose wall
 * faces `(nx, nz)` out of the building, looking along `(dx, dy, dz)`.
 */
export function interiorStep(
  px: number,
  py: number,
  pz: number,
  nx: number,
  nz: number,
  dx: number,
  dy: number,
  dz: number,
): number {
  const l = Math.hypot(nx, nz) || 1
  const [ux, uz, inx, inz] = [nz / l, -nx / l, -nx / l, -nz / l]
  const a = px * ux + pz * uz
  const [ia, ib] = [Math.floor(a / W), Math.floor(py / H)]
  const [la, lb] = [a - ia * W, py - ib * H]
  const da = dx * ux + dz * uz
  const dn = Math.max(0.05, dx * inx + dz * inz)
  const tSide = da > 0 ? (W - la) / da : da < 0 ? -la / da : Number.POSITIVE_INFINITY
  const tFloor = dy > 0 ? (H - lb) / dy : dy < 0 ? -lb / dy : Number.POSITIVE_INFINITY
  const tBack = D / dn
  let t = Math.min(tSide, tFloor, tBack)
  let face = t === tBack ? 0 : t === tFloor ? (dy > 0 ? 1 : 2) : 3
  let boxTone = -2
  // The room's furniture, seeded by its cell: boxes in room space (along the wall, up, into the room).
  const h = (k: number): number => lattice(ia * 7 + k, ib * 13, 23)
  const boxes: Box[] = []
  const sx = h(1) * (W - 1.6)
  const tx = 0.3 + h(2) * (W - 1.4)
  const lx = h(3) < 0.5 ? 0.25 : W - 0.45
  const lamp = h(6) < 0.6
  boxes.push([sx, 0, D - 0.85, sx + 1.5, h(4) < 0.5 ? 0.75 : 0.5, D, -3])
  if (h(5) < 0.7) boxes.push([tx, 0, 1.2, tx + 0.9, 0.75, 1.9, -2])
  if (lamp) boxes.push([lx, 0, D - 1.3, lx + 0.2, 1.55, D - 1.1, -3])
  for (const [a0, b0, c0, a1, b1, c1, tone] of boxes) {
    // A slab test along the ray (la + da·s, lb + dy·s, dn·s): the face it enters by is the face it shows.
    let [t0, t1, hit] = [0, t, -1]
    const slab = (o: number, d: number, lo: number, hi: number, f: number): boolean => {
      if (Math.abs(d) < 1e-6) return o >= lo && o <= hi
      let s0 = (lo - o) / d
      let s1 = (hi - o) / d
      if (s0 > s1) [s0, s1] = [s1, s0]
      if (s0 > t0) {
        t0 = s0
        hit = f
      }
      t1 = Math.min(t1, s1)
      return t0 <= t1
    }
    if (slab(la, da, a0, a1, 3) && slab(lb, dy, b0, b1, 1) && slab(0, dn, c0, c1, 0) && t0 < t) {
      t = t0
      face = 10 + hit
      boxTone = tone
    }
  }
  const [ha, hb, hc] = [la + da * t, lb + dy * t, dn * t]
  // A box: its top lit, its side a step down from it, its front darkest.
  if (face >= 10) return face === 11 ? boxTone + 2 : face === 13 ? boxTone + 1 : boxTone
  if (face === 0) return hb > H * 0.62 ? 0 : hb > H * 0.3 ? -1 : -2
  if (face === 2) {
    // The floor: the lamp's pool, then the ceiling light's.
    if (lamp && Math.hypot(ha - lx - 0.1, hc - (D - 1.2)) < 0.75) return 0
    return Math.hypot(ha - W / 2, hc - D * 0.5) < 0.6 ? -1 : -3
  }
  if (face === 1) return Math.hypot(ha - W / 2, hc - D * 0.5) < 0.45 ? 1 : -1
  return -2
}

/** Texels a metre the room is drawn at: a window is a few metres across, a handful of texels at the look's field. */
const TEXELS = 12
/** How far down (radians) the glass is seen into the wall. */
const TILT = (25 * Math.PI) / 180
/** The most texels a side takes. */
const MAX = 64

/**
 * A window glass as a tile of its room: `mesh` is the glass (a quad), `ladder` the swatch's steps, and each texel the step
 * its ray takes into the room (`interiorStep`), clamped to the ladder. `uvs` lay the tile across the glass, row 0 at the top.
 */
export function windowTile(mesh: MeshData, ladder: Ladder): { tile: AlbedoTile; uvs: Float32Array } {
  const [nx, nz] = [mesh.normals[0] as number, mesh.normals[2] as number]
  const size = Math.hypot(nx, nz) || 1
  const [ex, ez] = [nx / size, nz / size]
  // Along the wall: left to right as seen from outside, (n.z, −n.x).
  const [tx, tz] = [ez, -ex]
  let [u0, u1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity]
  let [ox, oz] = [0, 0]
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const [x, y, z] = [
      mesh.positions[i] as number,
      mesh.positions[i + 1] as number,
      mesh.positions[i + 2] as number,
    ]
    const u = x * tx + z * tz
    if (u < u0) [u0, ox, oz] = [u, x, z]
    u1 = Math.max(u1, u)
    y0 = Math.min(y0, y)
    y1 = Math.max(y1, y)
  }
  const [width, height] = [Math.max(u1 - u0, 1e-3), Math.max(y1 - y0, 1e-3)]
  const [w, h] = [
    Math.min(MAX, Math.max(8, Math.round(width * TEXELS))),
    Math.min(MAX, Math.max(8, Math.round(height * TEXELS))),
  ]
  // Into the wall and down.
  const [dx, dy, dz] = [-ex * Math.cos(TILT), -Math.sin(TILT), -ez * Math.cos(TILT)]
  const rgba = new Uint8Array(w * h * 4)
  for (let row = 0; row < h; row++)
    for (let col = 0; col < w; col++) {
      const u = u0 + ((col + 0.5) / w) * width
      const y = y1 - ((row + 0.5) / h) * height
      // The point on the glass: the wall's start point moved along the wall by `u − u0`.
      const [px, pz] = [ox + tx * (u - u0), oz + tz * (u - u0)]
      const step = Math.max(0, Math.min(STEPS - 1, ladder.base + interiorStep(px, y, pz, ex, ez, dx, dy, dz)))
      const colour = ladder.steps[step] as number
      rgba.set([(colour >> 16) & 255, (colour >> 8) & 255, colour & 255, 255], (row * w + col) * 4)
    }
  const uvs = new Float32Array((mesh.positions.length / 3) * 2)
  for (let i = 0; i < mesh.positions.length / 3; i++) {
    const [x, y, z] = [
      mesh.positions[i * 3] as number,
      mesh.positions[i * 3 + 1] as number,
      mesh.positions[i * 3 + 2] as number,
    ]
    uvs[i * 2] = (x * tx + z * tz - u0) / width
    uvs[i * 2 + 1] = 1 - (y - y0) / height
  }
  return { tile: { width: w, height: h, texels: [TEXELS, TEXELS], rgba, seed: 0 }, uvs }
}

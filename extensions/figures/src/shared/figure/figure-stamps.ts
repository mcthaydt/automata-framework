import { J, type Skeleton } from '../body/rig'
import { apply, applyDir, type M, type V3 } from '../math/math'
import type { FaceStamp, HandStamp } from '../paint/paint'
import type { GBuffer } from '../paint/raster'
import type { CastMember } from './cast'
import type { Built } from './figure-build'

/** What the stamps read of a figure at one pose: the built parts, the skeleton, the cast member, the world matrices of the
 * pose, and the cell's size and scale. `Figure` hands these over once each raster, so the stamps are plain functions of them. */
export interface Posed {
  built: Built
  skeleton: Skeleton
  member: CastMember
  world: M[]
  cell: [number, number]
  metres: number
  feet: number
}

/** An eye's drawn width (m; paint.ts FaceStamp.eye): two texels at the brand kit's density, four at twice it (a JRPG
 * sprite's eye, with a two-texel iris). */
const EYE = 0.05
/** The widest an eye may be, as a fraction of the head's half-width: a little over half of it, so the two eyes and the
 * bridge between them leave the face its cheeks. The base pair's heads (half-width of 8 or more texels at density 2) never
 * reach it, so the cap changes nothing for them; a small head (the `head` slider low) gets a narrower eye in place of one
 * that covers a third of its face. */
const EYE_OF_FACE = 0.52
/** An eye's drawn width (texels; paint.ts FaceStamp.eye) on a head of the given half-width (texels) at `ppm` pixels per
 * metre: the density's own size (`EYE`), capped at `EYE_OF_FACE` of the half-width, and never under one texel. */
export const eyeWidth = (halfWidth: number, ppm: number): number =>
  Math.max(1, Math.min(Math.round(EYE * ppm), Math.round(EYE_OF_FACE * halfWidth)))

/**
 * Where the drawn face goes this pose: the eye row's centre on the face, projected into the cell, and which template
 * the head's yaw toward the camera picks (0 front … ±2 profile; past that the face is turned away).
 */
export function faceAt(
  f: Posed,
  pitch: number,
  blink: boolean,
  mood: Set<string> = new Set(),
): FaceStamp | null {
  const skin = f.built.materialIndex.get(f.member.skin)
  if (skin === undefined) return null
  const g = f.skeleton.genes,
    m = f.world[J.head],
    [w, h] = f.cell,
    ppm = h / f.metres,
    cp = Math.cos(pitch),
    sp = Math.sin(pitch)
  const hw = (g.head * g.headWidth) / 2,
    hd = (g.head * g.headDepth) / 2,
    H = g.head,
    z = (u: number) => hd * (g.faceAhead + u)
  // Head space (garments.ts head) into the cell's texels.
  const at = (p: V3): [number, number] => {
    const q = apply(m, p)
    return [w / 2 + q[0] * ppm, h - f.feet - (q[1] * cp - q[2] * sp) * ppm]
  }
  // The drawn eyes' set (eyeSpacing; exactly 0.42 at 0.5). The undrawn face's decals (garments.ts face) and the gaze keep 0.42.
  const ex = hw * (0.42 + 0.08 * (f.built.face.shape.eyeSpacing - 0.5) * 2),
    D = Math.round(ppm / (96 / 2.6))
  const eyes = [at([ex, H * 0.45, z(0.88)]), at([-ex, H * 0.45, z(0.88)])].sort((a, b) => a[0] - b[0]) as [
    [number, number],
    [number, number],
  ]
  const yaw = Math.atan2(m[2], m[8]),
    detail = eyeWidth(hw * ppm, ppm)
  // The head's frame in the cell: its origin (texels, and depth), and the turn from the view's axes (x right, y up,
  // toward the camera: in the figure's space (1,0,0), (0,cp,−sp), (0,sp,cp)) into the head's own.
  const view = [
      [1, 0, 0],
      [0, cp, -sp],
      [0, sp, cp],
    ],
    R: number[] = []
  for (let i = 0; i < 3; i++)
    for (let k = 0; k < 3; k++) R.push(m[i] * view[k][0] + m[3 + i] * view[k][1] + m[6 + i] * view[k][2])
  return {
    // The eyes one size on every face, whatever the figure's height: the cell's density sizes them, capped by the face's width.
    view: Math.round(yaw / (Math.PI / 4)),
    size: hw * ppm,
    detail,
    eye:
      D >= 2
        ? Math.max(2, detail + Math.round((f.built.face.shape.eyeSize - 0.5) * 2) * (D >= 4 ? 2 : 1))
        : detail,
    centre: at([0, H * 0.45, z(1)]),
    eyes,
    nose: at([0, H * 0.23, z(1.06)]),
    mouth: at([0, H * 0.17, z(1)]),
    frame: {
      o: [w / 2 + m[9] * ppm, h - f.feet - (m[10] * cp - m[11] * sp) * ppm, m[10] * sp + m[11] * cp],
      ppm,
      R,
      head: [hw, H, hd, g.faceAhead],
    },
    skin,
    ...f.built.face,
    blink,
    mood,
  }
}

/**
 * Where each hand goes this pose (paint.ts HandStamp): its wrist and fingertips projected into the cell, its widths
 * across the axis there (the cross-section's breadth and thickness as the view sees them), which side the thumb is on,
 * the back of the hand's normal, and whether it hangs.
 */
export function handsAt(f: Posed, pitch: number): HandStamp[] {
  const [w, h] = f.cell,
    ppm = h / f.metres,
    cp = Math.cos(pitch),
    sp = Math.sin(pitch),
    out: HandStamp[] = []
  for (const s of f.built.hands) {
    const m = f.world[J[`hand.${s.side}`]],
      material = f.built.materialIndex.get(s.material)
    if (!m || material === undefined) continue
    const at = (p: V3): [number, number, number] => {
      const q = apply(m, p)
      return [w / 2 + q[0] * ppm, h - f.feet - (q[1] * cp - q[2] * sp) * ppm, q[1] * sp + q[2] * cp]
    }
    const view = (d: V3): V3 => {
      const q = applyDir(m, d)
      return [q[0], q[1] * cp - q[2] * sp, q[1] * sp + q[2] * cp]
    }
    const wrist = at([s.c[0], 0, s.c[1]]),
      tip = at([s.c[0], -s.len, s.c[1]]),
      axis = view([0, -1, 0])
    // The axis on screen (y down), and across it; a hand pointing at the camera keeps its axis's own lean.
    let ax = tip[0] - wrist[0],
      ay = tip[1] - wrist[1]
    if (Math.hypot(ax, ay) < 0.5) {
      ax = axis[0]
      ay = -axis[1]
    }
    const al = Math.hypot(ax, ay) || 1,
      a: [number, number] = [ax / al, ay / al],
      p: [number, number] = [-a[1], a[0]]
    const vb = view([s.across[0], 0, s.across[1]]),
      vt = view([s.back[0], 0, s.back[1]])
    const across = (b: number, t: number) =>
      ppm * Math.hypot(b * (vb[0] * p[0] - vb[1] * p[1]), t * (vt[0] * p[0] - vt[1] * p[1]))
    const side = vb[0] * p[0] - vb[1] * p[1] >= 0 ? 1 : -1
    out.push({
      group: s.group,
      material,
      wrist,
      tip,
      axis,
      half: [across(s.wrist, s.thick[0]), across(s.breadth, s.thick[1])],
      breadth: [ppm * s.wrist, ppm * s.breadth],
      front: s.breadth * Math.abs(vb[2]) + s.thick[1] * Math.abs(vt[2]),
      thumb: [p[0] * side, p[1] * side],
      thumbAt: s.thumb,
      thumbFacing: vb[2],
      back: vt,
      hangs: applyDir(m, [0, -1, 0])[1] < -0.75,
    })
  }
  return out
}

/** `depth` from the G-buffer and the painted cell: a surface texel keeps its depth; an opaque texel with none (the outline
 * ring, drawn beside the surface) takes the nearest depth among its neighbours, widening a ring at a time until a surface
 * is found (the outline's width grows with the density, so no fixed radius would do); an empty one is −Infinity. The root's
 * plane (0) is only for a cell with no surface at all. */
export function fillDepth(
  cell: readonly [number, number],
  g: GBuffer,
  painted: Uint8ClampedArray,
  out: Float32Array,
) {
  const [w, h] = cell,
    z = g.depth,
    px = painted,
    reach = Math.max(w, h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = y * w + x
      if (!px[k * 4 + 3]) {
        out[k] = -Infinity
        continue
      }
      if (z[k] > -Infinity) {
        out[k] = z[k]
        continue
      }
      let best = -Infinity
      for (let r = 1; r <= reach && best === -Infinity; r++)
        for (let dy = -r; dy <= r; dy++)
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
            const X = x + dx,
              Y = y + dy
            if (X >= 0 && X < w && Y >= 0 && Y < h && z[Y * w + X] > best) best = z[Y * w + X]
          }
      out[k] = best > -Infinity ? best : 0
    }
}

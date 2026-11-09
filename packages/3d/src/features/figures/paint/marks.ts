// The marks a posed figure gives the painter: where its drawn face goes (the eye row, the nose, the mouth and the template
// the head's yaw picks), where each hand goes and how it is sized, and the limbs' joints the painter models each bone's
// segment from. All of it is read off the world matrices of one pose, projected into the cell.

import { atan2, cos, hypot, sin } from '@automata/sim/math'
import { apply, applyDir, type M, type V3 } from '../../../shared/math/math.ts'
import { DEFAULT_HEAD, type HeadShape } from '../body/genes.ts'
import { GROUP, type Part } from '../body/mesh.ts'
import { J, type Side, type Skeleton } from '../body/rig.ts'
import type { PainterMaterial } from '../figure/materials.ts'
import { duel, tonesOf } from './duel-snap.ts'
import type { FaceStamp } from './face-stamp.ts'
import type { Bends, HandStamp } from './hand-stamp.ts'
import { eyeWhite, familyTones } from './tones.ts'
import { must } from './vec.ts'

/** A hand's measures in its own bone's space (x the figure's left, y up the bone, z forward), from the parts the hand
 * bone carries: so the hand stamp is sized from the hand the figure wears. */
export interface HandShape {
  side: Side
  group: number
  material: string
  /** Wrist to fingertips (m), and the centre line's place across the bone (x, z). */
  len: number
  c: [number, number]
  /** The breadth's axis across the bone (x, z: toward the thumb), the half-breadth at the wrist and at the knuckles, and
   * the half-thickness there; the back of the hand's side along the thickness axis (x, z). */
  across: [number, number]
  wrist: number
  breadth: number
  thick: [number, number]
  back: [number, number]
  /** The thumb's span down the hand (fractions of `len`). */
  thumb: [number, number]
}

const points = (ps: readonly Part[]): V3[] =>
  ps.flatMap((p) => {
    const v: V3[] = []
    for (let i = 0; i < p.mesh.positions.length; i += 3)
      v.push([must(p.mesh.positions, i), must(p.mesh.positions, i + 1), must(p.mesh.positions, i + 2)])
    return v
  })
const mean = (v: readonly V3[], k: 0 | 2): number => v.reduce((s, p) => s + p[k], 0) / v.length

/** The hand bones' parts as measures: the palm and fingers together, the thumb (a surface of its own) apart. */
export function handShapes(parts: readonly Part[]): HandShape[] {
  const out: HandShape[] = []
  for (const side of ['L', 'R'] as const) {
    const mine = parts.filter((p) => p.bone === J[`hand.${side}`] && p.group !== GROUP.item)
    const first = mine[0]
    if (first === undefined) continue
    const hand = mine.filter((p) => p.seam === first.seam)
    const thumb = mine.filter((p) => p.seam !== first.seam)
    const P = points(hand)
    const T = points(thumb)
    const len = -Math.min(...P.map((v) => v[1]))
    const cx = mean(P, 0)
    const cz = mean(P, 2)
    // The breadth runs along the cross-section's long axis (its xz spread's first principal axis), toward the thumb.
    let xx = 0
    let zz = 0
    let xz = 0
    for (const v of P) {
      const a = v[0] - cx
      const b = v[2] - cz
      xx += a * a
      zz += b * b
      xz += a * b
    }
    const ang = 0.5 * atan2(2 * xz, xx - zz)
    let across: [number, number] = [cos(ang), sin(ang)]
    const tc = T.length ? [mean(T, 0) - cx, mean(T, 2) - cz] : [0, 1]
    if (across[0] * (tc[0] ?? 0) + across[1] * (tc[1] ?? 0) < 0) across = [-across[0], -across[1]]
    const thickAxis: [number, number] = [-across[1], across[0]]
    const ext = (lo: number, hi: number, ax: readonly [number, number]): number =>
      Math.max(
        ...P.filter((v) => -v[1] >= lo * len && -v[1] <= hi * len).map((v) =>
          Math.abs((v[0] - cx) * ax[0] + (v[2] - cz) * ax[1]),
        ),
      )
    // The back of the hand faces out from the body (the palm to the thigh): +x on the left hand.
    const outward = side === 'L' ? 1 : -1
    const back: [number, number] = thickAxis[0] * outward >= 0 ? thickAxis : [-thickAxis[0], -thickAxis[1]]
    const ty = T.map((v) => -v[1] / len)
    out.push({
      side,
      group: first.group,
      material: first.material,
      len,
      c: [cx, cz],
      across,
      wrist: ext(0, 0.15, across),
      breadth: ext(0.4, 0.7, across),
      thick: [ext(0, 0.15, thickAxis), ext(0.4, 0.7, thickAxis)],
      back,
      thumb: ty.length ? [Math.min(...ty), Math.max(...ty)] : [0.2, 0.6],
    })
  }
  return out
}

/** The limbs' joints at rest, for the painter to model each bone's segment. */
export function bendsOf(s: Skeleton): Bends {
  const r = s.rest
  const y = (name: string): number => must(must(r, J[name as keyof typeof J]), 1)
  const b: Bends = {}
  for (const side of ['L', 'R'] as const) {
    b[side === 'L' ? GROUP.armL : GROUP.armR] = [
      y(`upperArm.${side}`),
      y(`foreArm.${side}`),
      y(`hand.${side}`),
    ]
    b[side === 'L' ? GROUP.legL : GROUP.legR] = [y(`thigh.${side}`), y(`shin.${side}`), y(`foot.${side}`)]
  }
  return b
}

/** An eye's drawn width (m): two texels at the sheets' density, four at twice it (a JRPG sprite's eye, with a two-texel iris). */
const EYE = 0.05
/** The widest an eye may be, as a fraction of the head's half-width: a little over half of it, so the two eyes and the
 * bridge between them leave the face its cheeks. A small head gets a narrower eye in place of one that covers a third of it. */
const EYE_OF_FACE = 0.52
/** An eye's drawn width (texels) on a head of the given half-width (texels) at `ppm` texels a metre: the density's own size,
 * capped at `EYE_OF_FACE` of the half-width, and never under one texel. */
export const eyeWidth = (halfWidth: number, ppm: number): number =>
  Math.max(1, Math.min(Math.round(EYE * ppm), Math.round(EYE_OF_FACE * halfWidth)))

/** The drawn face's structure and colours. */
export type DrawnFace = Pick<FaceStamp, 'shape' | 'iris' | 'lash' | 'white' | 'brow' | 'lips'>

/** The materials the drawn face takes its colours from; any left out take the defaults below. */
export interface FacePalette {
  readonly skin?: PainterMaterial | undefined
  readonly eyes?: PainterMaterial | undefined
  readonly white?: PainterMaterial | undefined
  readonly brows?: PainterMaterial | undefined
  readonly lips?: PainterMaterial | undefined
}

/**
 * The face's colours from its materials' tones: the iris and lash the eyes' first two (a dark brown and a near-black
 * where none are named), the whites dimmed to the skin, the brow the brows' second, and the lips' three (the skin's own
 * ramp where none are named). The near-blacks are the ramps' dark family, as the hair's are.
 */
export function drawnFace(shape: HeadShape | undefined, palette: FacePalette): DrawnFace {
  const tones = (m: PainterMaterial | undefined): number[] | null => (m ? familyTones(tonesOf(m)) : null)
  const eyes = tones(palette.eyes) ?? [duel(0x31222a), duel(0x1d1d21)]
  const skin = tones(palette.skin) ?? [0, 0, 0, 0]
  const lips = tones(palette.lips) ?? [skin[2] ?? 0, skin[1] ?? 0, skin[3] ?? 0]
  return {
    shape: shape ?? DEFAULT_HEAD,
    iris: eyes[0] ?? 0,
    lash: eyes[1] ?? 0,
    white: eyeWhite(tones(palette.white)?.[0] ?? duel(0xeadbc9), skin[1] ?? 0),
    brow: tones(palette.brows)?.[1] ?? eyes[1] ?? 0,
    lips: [lips[0] ?? 0, lips[1] ?? 0, lips[2] ?? 0],
  }
}

/** The pose's view of the cell: the camera's pitch, the cell's size, the metres it shows and the feet's row from the bottom. */
export interface CellFrame {
  readonly cell: readonly [number, number]
  readonly metres: number
  readonly feet: number
  readonly pitch: number
}

/**
 * Where the drawn face goes this pose: the eye row's centre on the face, projected into the cell, and which template the
 * head's yaw toward the camera picks (0 front … ±2 profile; past that the face is turned away).
 */
export function faceAt(
  skeleton: Skeleton,
  world: readonly M[],
  frame: CellFrame,
  face: DrawnFace,
  skin: number,
  blink: boolean,
  mood: Set<string>,
): FaceStamp {
  const g = skeleton.genes
  const m = must(world, J.head)
  const [w, h] = frame.cell
  const ppm = h / frame.metres
  const cp = cos(frame.pitch)
  const sp = sin(frame.pitch)
  const hw = (g.head * g.headWidth) / 2
  const hd = (g.head * g.headDepth) / 2
  const H = g.head
  const z = (u: number): number => hd * (g.faceAhead + u)
  // Head space into the cell's texels.
  const at = (p: V3): [number, number] => {
    const q = apply(m, p)
    return [w / 2 + q[0] * ppm, h - frame.feet - (q[1] * cp - q[2] * sp) * ppm]
  }
  // The drawn eyes' set (eyeSpacing; exactly 0.42 at 0.5). The undrawn face's decals and the gaze keep 0.42.
  const ex = hw * (0.42 + 0.08 * (face.shape.eyeSpacing - 0.5) * 2)
  const D = Math.round(ppm / (96 / 2.6))
  const eyes = [at([ex, H * 0.45, z(0.88)]), at([-ex, H * 0.45, z(0.88)])].sort((a, b) => a[0] - b[0]) as [
    [number, number],
    [number, number],
  ]
  const yaw = atan2(m[2], m[8])
  const detail = eyeWidth(hw * ppm, ppm)
  // The head's frame in the cell: its origin (texels, and depth), and the turn from the view's axes (x right, y up,
  // toward the camera: in the figure's space (1,0,0), (0,cp,−sp), (0,sp,cp)) into the head's own.
  const axes: readonly V3[] = [
    [1, 0, 0],
    [0, cp, -sp],
    [0, sp, cp],
  ]
  const R: number[] = []
  for (let i = 0; i < 3; i++)
    for (const [ax, ay, az] of axes) R.push(must(m, i) * ax + must(m, 3 + i) * ay + must(m, 6 + i) * az)
  const oy = h - frame.feet - (m[10] * cp - m[11] * sp) * ppm
  return {
    view: Math.round(yaw / (Math.PI / 4)),
    size: hw * ppm,
    detail,
    // The eyes one size on every face, whatever the figure's height: the cell's density sizes them, capped by the face's width.
    eye:
      D >= 2 ? Math.max(2, detail + Math.round((face.shape.eyeSize - 0.5) * 2) * (D >= 4 ? 2 : 1)) : detail,
    centre: at([0, H * 0.45, z(1)]),
    eyes,
    nose: at([0, H * 0.23, z(1.06)]),
    mouth: at([0, H * 0.17, z(1)]),
    frame: { o: [w / 2 + m[9] * ppm, oy, m[10] * sp + m[11] * cp], ppm, R, head: [hw, H, hd, g.faceAhead] },
    skin,
    ...face,
    blink,
    mood,
  }
}

/**
 * Where each hand goes this pose: its wrist and fingertips projected into the cell, its widths across the axis there (the
 * cross-section's breadth and thickness as the view sees them), which side the thumb is on, the back of the hand's
 * normal, and whether it hangs.
 */
export function handsAt(
  shapes: readonly HandShape[],
  world: readonly M[],
  frame: CellFrame,
  materialIndex: ReadonlyMap<string, number>,
): HandStamp[] {
  const [w, h] = frame.cell
  const ppm = h / frame.metres
  const cp = cos(frame.pitch)
  const sp = sin(frame.pitch)
  const out: HandStamp[] = []
  for (const s of shapes) {
    const m = world[J[`hand.${s.side}`]]
    const material = materialIndex.get(s.material)
    if (!m || material === undefined) continue
    const at = (p: V3): [number, number, number] => {
      const q = apply(m, p)
      return [w / 2 + q[0] * ppm, h - frame.feet - (q[1] * cp - q[2] * sp) * ppm, q[1] * sp + q[2] * cp]
    }
    const view = (d: V3): V3 => {
      const q = applyDir(m, d)
      return [q[0], q[1] * cp - q[2] * sp, q[1] * sp + q[2] * cp]
    }
    const wrist = at([s.c[0], 0, s.c[1]])
    const tip = at([s.c[0], -s.len, s.c[1]])
    const axis = view([0, -1, 0])
    // The axis on screen (y down), and across it; a hand pointing at the camera keeps its axis's own lean.
    let ax = tip[0] - wrist[0]
    let ay = tip[1] - wrist[1]
    if (hypot(ax, ay) < 0.5) {
      ax = axis[0]
      ay = -axis[1]
    }
    const al = hypot(ax, ay) || 1
    const a: [number, number] = [ax / al, ay / al]
    const p: [number, number] = [-a[1], a[0]]
    const vb = view([s.across[0], 0, s.across[1]])
    const vt = view([s.back[0], 0, s.back[1]])
    const across = (b: number, t: number): number =>
      ppm * hypot(b * (vb[0] * p[0] - vb[1] * p[1]), t * (vt[0] * p[0] - vt[1] * p[1]))
    const side = vb[0] * p[0] - vb[1] * p[1] >= 0 ? 1 : -1
    out.push({
      group: s.group,
      material,
      wrist,
      tip,
      axis,
      half: [across(s.wrist, s.thick[0]), across(s.breadth, s.thick[1])],
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

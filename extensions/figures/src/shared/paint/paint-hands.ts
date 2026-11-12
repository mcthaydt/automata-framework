// biome-ignore-all lint/style/noNonNullAssertion: the compiler needs these assertions until the strict flags (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) replace each with a check
import { K2 } from './paint-budget'
import {
  HAND_FORM,
  type HandFormKind,
  PARTED_HAND,
  paddleRole,
  partedHalf,
  partedRole,
} from './paint-hand-form'
import { KEY } from './paint-style'
// ─── Hands: drawn as the face is, from the projected wrist and fingertips ───
/**
 * A hand as a pixel artist draws one at sprite size (the raster's hand is a few texels and loses its thumb), placed from
 * its projected wrist and fingertips and sized from its own cross-section as the view sees it (figure.ts handsAt), so
 * any body, pose and density gets it.
 */
/** A limb group's joints' rest heights (the surface place's y, m) from its root down: the shoulder, the elbow and the
 * wrist; the hip, the knee and the ankle. */
export type Bends = Partial<Record<number, readonly number[]>>
export interface HandStamp {
  /** The arm's group and the hand's material. */
  group: number
  material: number
  /** Projected (texels, and depth in m): the wrist's middle and the fingertips'. */
  wrist: [number, number, number]
  tip: [number, number, number]
  /** The bone in view axes (x right, y up, z toward the camera), wrist to fingertips. */
  axis: [number, number, number]
  /** Half-widths (texels) across the axis at the wrist and at the knuckles, and how far its front stands toward the
   * camera from its middle (m). */
  half: [number, number]
  /** The full half-breadth (texels) at the wrist and at the knuckles, however the hand is turned. */
  breadth: [number, number]
  front: number
  /** Across the axis toward the thumb (texels, y down), and the thumb's span down the hand (fractions of its length). */
  thumb: [number, number]
  thumbAt: [number, number]
  /** How far the thumb's side turns toward the camera (−1 away … 1 toward). */
  thumbFacing: number
  /** The back of the hand's normal, in view axes. */
  back: [number, number, number]
  /** Its fingers point down (a hanging hand); else it holds something (a hip, an arm, a pocket's edge). */
  hangs: boolean
}
/**
 * The hands, drawn into the painter's G-buffer and toned (`tone`, −1 where no hand): the raster's hand gives way to a
 * designed one, and only where nothing nearer covers it.
 * - The shape (paint-hand-form.ts, `form`): the paddle (a wrist, a palm, a one-texel thumb on its edge, the tips notched)
 *   or the parted hand (the thumb hanging free of the palm at its tip, the index parted from the other three fingers,
 *   which are one mitten); HAND_FORM is the default.
 * - Its tones, in the skin's ramp: the back's edge toward the key its light plane, the knuckle row a step darker under
 *   it with the light's corner kept, the edge away from the key in shadow, a step of shadow at the thumb's tip; the
 *   parted hand's partings a crease, a step under the hand's tone.
 * - In a pocket (most of it covered), nothing: only the forearm going into the opening, never a sliver of skin.
 */
export function drawHands(
  hands: HandStamp[],
  w: number,
  h: number,
  D: number,
  b: {
    material: Int16Array
    part: Int16Array
    group: Int16Array
    depth: Float32Array
    normal: Float32Array
    place: Float32Array
  },
  form: HandFormKind = HAND_FORM,
): Int8Array {
  const n = w * h,
    ppm = (96 * D) / 2.6,
    tone = new Int8Array(n).fill(-1),
    { material, part, group, depth, normal, place } = b
  for (const hs of hands) {
    const [wx, wy, wz] = hs.wrist,
      A3 = [hs.axis[0], -hs.axis[1], hs.axis[2]]
    // The raster's hand: this arm's texels of the hand's material past the wrist.
    const mine: number[] = []
    let handPart = -1,
      wristPlace = -1,
      nearest = Infinity
    for (let k = 0; k < n; k++) {
      if (material[k] !== hs.material || group[k] !== hs.group) continue
      const x = k % w,
        y = (k - x) / w,
        s = (x + 0.5 - wx) * A3[0] + (y + 0.5 - wy) * A3[1] + (depth[k] - wz) * ppm * A3[2]
      if (s > 0.25) {
        mine.push(k)
        if (handPart < 0) handPart = part[k]
      } else if (-s < nearest) {
        nearest = -s
        wristPlace = k
        if (handPart < 0) handPart = part[k]
      }
    }
    if (handPart < 0) continue
    // It gives way to what lies round it and behind it (the cloth it was in front of), or to nothing at the silhouette:
    // a surface nearer than the hand (a trouser's hip, seen from behind the hand) never floods where the hand hung.
    const gone = new Set(mine),
      was = new Map(mine.map((k) => [k, depth[k]]))
    for (let pass = 0; pass < 6 && gone.size; pass++) {
      const fill: [number, number][] = []
      for (const k of gone) {
        const x = k % w
        let best = -1
        for (const q of [x > 0 ? k - 1 : -1, x < w - 1 ? k + 1 : -1, k - w, k + w])
          if (
            q >= 0 &&
            q < n &&
            !gone.has(q) &&
            material[q] >= 0 &&
            group[q] !== hs.group &&
            depth[q] < was.get(k)! &&
            (best < 0 || depth[q] < depth[best])
          )
            best = q
        if (best >= 0) fill.push([k, best])
      }
      if (!fill.length) break
      for (const [k, q] of fill) {
        material[k] = material[q]
        part[k] = part[q]
        group[k] = group[q]
        depth[k] = depth[q]
        for (let i = 0; i < 3; i++) {
          normal[k * 3 + i] = normal[q * 3 + i]
          place[k * 3 + i] = place[q * 3 + i]
        }
        gone.delete(k)
      }
    }
    for (const k of gone) {
      material[k] = -1
      part[k] = -1
      group[k] = -1
      depth[k] = -Infinity
    }
    // The axis on screen, straightened when it is within 20° of plumb or level (a hanging hand's columns stay clean).
    let ax = hs.tip[0] - wx,
      ay = hs.tip[1] - wy,
      L = Math.hypot(ax, ay)
    if (L < 0.5) {
      ax = hs.axis[0]
      ay = -hs.axis[1]
    }
    let ang = Math.atan2(ay, ax)
    const square = Math.round(ang / (Math.PI / 2)) * (Math.PI / 2),
      snapped = Math.abs(ang - square) < 0.35
    if (snapped) ang = square
    const a = [Math.round(Math.cos(ang) * 1e6) / 1e6, Math.round(Math.sin(ang) * 1e6) / 1e6]
    let p = [-a[1], a[0]]
    if (p[0] * hs.thumb[0] + p[1] * hs.thumb[1] < 0) p = [-p[0], -p[1]]
    // Sizes: the wrist as the arm shows it (two texels at least), the knuckles a texel broader from twice the brand
    // kit's density; the length its projection's, a hanging hand's fingers curled short of it (never shorter than the
    // hand is broad).
    // The parted hand is drawn larger and longer, its back turned toward the view (paint-hand-form.ts PARTED_HAND),
    // from twice the brand kit's density.
    const parted = form === 'parted' && D > 1,
      half = parted ? partedHalf(hs.half, hs.breadth) : hs.half
    const Ww = Math.max(2, Math.round(2 * half[0])),
      Wk = Math.max(Ww + (D > 1 ? 1 : 0), Math.round(2 * half[1]))
    L = Math.max(L * (hs.hangs ? 0.86 : 1), Wk + 1, parted ? PARTED_HAND.long * Wk : 0)
    // The origin on texel edges when straightened, so each column and row is whole.
    let ox = wx,
      oy = wy
    if (snapped) {
      const across = Math.abs(p[0]) > 0.5
      if (across) {
        ox = Math.round(wx - Ww / 2) + Ww / 2
        oy = Math.round(wy)
      } else {
        oy = Math.round(wy - Ww / 2) + Ww / 2
        ox = Math.round(wx)
      }
    }
    const lo = -Ww / 2,
      kSide = p[0] * K2[0] + p[1] * K2[1] > 0 ? 1 : -1
    const z = (s: number) => wz + (hs.tip[2] - wz) * Math.min(1, s / L) + hs.front
    // The back of the hand's light: toward the key it has its light plane, turned from it the hand sits a step down.
    const kb = hs.back[0] * KEY[0] + hs.back[1] * KEY[1] + Math.abs(hs.back[2]) * KEY[2],
      dim = kb < -0.25 ? 1 : 0
    // The tone of each texel down and across the hand (paint-hand-form.ts), −1 where it is not.
    const role = (form === 'parted' ? partedRole : paddleRole)({ L, Ww, Wk, D, hs, kSide, dim, lo })
    // The texels it covers, and how many of them show (nothing nearer there).
    const r = Math.ceil(L + Wk + 2),
      cx = Math.round(ox),
      cy = Math.round(oy),
      cells: [number, number, number][] = []
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++) {
        if (x < 0 || y < 0 || x >= w || y >= h) continue
        const dx = x + 0.5 - ox,
          dy = y + 0.5 - oy,
          s = dx * a[0] + dy * a[1],
          t = dx * p[0] + dy * p[1],
          q = role(s, t)
        if (q >= 0) cells.push([y * w + x, q, s])
      }
    const shows = cells.filter(([k, , s]) => material[k] < 0 || depth[k] < z(s))
    // In a pocket: nothing of it but the wrist at the opening.
    if (shows.length < Math.max(2 * D * D, 0.35 * cells.length)) continue
    const bn = hs.back[2] < 0 ? hs.back.map((c) => -c) : hs.back
    for (const [k, q, s] of shows) {
      material[k] = hs.material
      part[k] = handPart
      group[k] = hs.group
      depth[k] = z(s)
      tone[k] = q
      for (let i = 0; i < 3; i++) {
        normal[k * 3 + i] = bn[i]
        place[k * 3 + i] = wristPlace >= 0 ? place[wristPlace * 3 + i] : 0
      }
    }
  }
  return tone
}

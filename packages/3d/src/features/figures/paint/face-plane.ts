import { smooth } from '../../../shared/math/math.ts'
import type { HeadShape } from '../body/genes.ts'
import { hypot3, norm } from './vec.ts'
/** The face's front planes (facePlane's last value: forehead and brow, bridge, each cheekbone's top, chin) and the share
 * of each in the light tone, its brightest: so the light lands on each as a shape of its own, as a pixel artist blocks
 * a face in, and the side of the head (temple, cheek, jaw) is a step down. */
export const LIGHT: number[] = [0, 0.14, 0.18, 0.12, 0.12, 0.18]
/** The share of a face in its deep tone: none. A sprite's face is flat, its skin mostly the mid with a soft shadow side
 * and a little light on its front planes (`model`, LIGHT); a deep tone on it reads as dirt at sprite size. */
export const FACE_DEEP = 0
/** The head's surface (garments.ts head): the drawn face goes on its skin and nowhere else. */
export const FACE_SEAM = 1000
/** Hair's seams (hair.ts HAIR_SEAM, and its ropes' own after it): a fringe over an eye is not shades. */
export const HAIR_SEAMS: number[] = [2000, 3000]
/**
 * The face's planes, as a pixel artist models a head (not a sphere the key splits down the middle): a texel's normal on
 * the head's own form (`p`, `n` in the head's space: x the figure's left, y up from the chin, z forward) turned toward
 * the plane it lies on. The forehead and the brow ridge face up and forward; the eye sockets under the brow face down,
 * their inner walls toward the nose; the cheekbone's crest faces up and out, the hollow under it down; the muzzle and
 * the forehead's front are flatter than the form; the chin's top faces up (its catch light); the jaw's side plane faces
 * out and down. Each band sits at the head's own landmarks (its cheekbone's height, the eye line) and its strength is
 * the head's structure (the cheekbones' and the jaw's prominence, the chin), so any head gets its planes, and the light
 * lands on them in clusters: the key side's forehead, cheekbone and chin, the far side's cheek and jaw in shadow.
 */
export function facePlane(
  F: HeadShape,
  hw: number,
  H: number,
  p: readonly number[],
  n: readonly number[],
): [number, number, number, number] {
  const t = (p[1] ?? Number.NaN) / H,
    u = (p[0] ?? Number.NaN) / hw,
    ax = Math.abs(u),
    sx = u < 0 ? -1 : 1
  const eyeT = 0.45,
    browT = eyeT + 0.075,
    cheekT = 0.33 + 0.1 * F.cheekHeight,
    noseT = 0.25
  // Where the front turns into the side: the eyes' outer corners, further out on a broad face.
  const corner = 0.56 + 0.16 * F.width
  // Each band's share: soft over its edge (a texel or so of the head), so one plane turns into the next over a step, not
  // along a straight cut; the chain takes each plane in turn from what the planes before it leave.
  const over = (v: number, e: number, b = 0.022) => smooth((v - e) / (2 * b) + 0.5),
    under = (v: number, e: number, b?: number) => 1 - over(v, e, b)
  let x = 0,
    y = 0,
    z = 0,
    left = 1,
    front = 0,
    most = 0
  // `lit`: the front plane (LIGHT's index) whose light this is, and how much of it.
  const take = (m: number, f: [number, number, number], id = 0, lit = 1) => {
    const wt = left * m,
      l = norm(f)
    x += (wt * f[0]) / l
    y += (wt * f[1]) / l
    z += (wt * f[2]) / l
    left -= wt
    if (id && wt * lit > most) {
      most = wt * lit
      front = id
    }
  }
  // The planes, as a head is blocked in (x out toward its own side, y up, z forward). The side of the head (temple,
  // cheek, jaw) turns only part way from the front, a half-tone; the front's planes (forehead, brow, bridge,
  // cheekbone's top, chin) face forward and up, where the light lands.
  take(over(t, browT + 0.14), [u * 0.5, 0.5, 0.75]) // the forehead's top, turning back
  take(over(t, eyeT + 0.02) * over(ax, corner + 0.06, 0.05), [sx * 0.7, 0.15, 0.7]) // the temple
  take(over(t, browT), [u * 0.3, 0.12, 1], 1) // the forehead's front
  take(over(t, eyeT + 0.025), [u * 0.35, 0.5, 0.85], 1) // the brow ridge
  take(over(t, eyeT - 0.055) * over(ax, 0.12, 0.04) * under(ax, corner + 0.1, 0.05), [
    sx * 0.3 * under(ax, 0.3, 0.05),
    -0.55,
    0.8,
  ]) // the socket under it
  take(under(ax, 0.12, 0.03) * over(t, noseT), [0, 0.2 + 0.15 * F.bridge, 1], 2) // the bridge
  take(under(ax, 0.24, 0.03) * over(t, noseT) * under(t, eyeT - 0.04), [sx * 0.8, -0.05, 0.6]) // the nose's side
  take(
    over(t, cheekT - 0.045) * under(ax, 1.05, 0.05),
    [sx * (0.3 + 0.15 * F.cheekWidth), 0.55, 0.8],
    u < 0 ? 3 : 4,
    under(ax, corner + 0.05, 0.05),
  ) // the cheekbone, up (its front under the eye)
  take(over(t, 0.11) * over(ax, corner, 0.05), [sx * 0.65, -0.25, 0.7]) // the cheek's side
  take(over(t, 0.11) * over(ax, 0.4, 0.05), [sx * 0.35, -0.1 - 0.15 * F.cheekWidth, 0.92]) // its front, the hollow
  take(over(t, 0.1), [u * 0.6, -0.05, 1]) // the muzzle round the mouth
  take(under(t, 0.035, 0.015), [u * 0.3, -0.75, 0.55]) // under the jaw
  take(under(ax, 0.45 + 0.1 * F.chin, 0.06), [u * 0.4, 0.35 + 0.15 * F.chin, 0.9], 5) // the chin, its top catching
  take(1, [sx * 0.7, -0.3, 0.65]) // the jaw's side
  // The facet, and the front plane it lies on (0 none: where the light tone may land) where most of it is one.
  const l = hypot3(x, y, z) || 1
  return [x / l, y / l, z / l, most >= 0.5 ? front : 0]
}
/** A facet (facePlane) over the form's own normal `n`, `wf` of it the facet's. */
export function onForm(pl: readonly number[], n: readonly number[], wf: number): number[] {
  const X = wf * (pl[0] ?? Number.NaN) + (1 - wf) * (n[0] ?? Number.NaN),
    Y = wf * (pl[1] ?? Number.NaN) + (1 - wf) * (n[1] ?? Number.NaN),
    Z = wf * (pl[2] ?? Number.NaN) + (1 - wf) * (n[2] ?? Number.NaN),
    m = hypot3(X, Y, Z) || 1
  return [X / m, Y / m, Z / m]
}

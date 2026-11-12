// biome-ignore-all lint/style/noNonNullAssertion: the compiler needs these assertions until task 23 of the builders-fold plan (the strict flags) replaces each with a check

import type { HeadShape } from '../body/genes'
import { smooth } from '../math/math'
import { RAMPS } from './duel-ramps'
import { INK_RGB, onRow } from './paint-budget'
import { oklab, type P } from './paint-style'
/** A face's white as one step over the skin's mid (`skinMid`), the same on every skin: the white's own DUEL row's tone
 * nearest `by` over the mid in lightness, so on deep skin it is no brighter than the face's light (the eyes would read
 * as a row of dots) and on light skin as white as its row goes. */
export function eyeWhite(white: number, skinMid: number, by = 0.25) {
  const top = oklab(skinMid)[0] + by,
    at = onRow(white, -1)
  if (!at) return white
  let best = white,
    bd = Infinity
  for (const c of RAMPS[at[0]]) {
    const d = Math.abs(oklab(c)[0] - top)
    if (c !== INK_RGB && d < bd) {
      bd = d
      best = c
    }
  }
  return best
}
/**
 * A drawn face, placed from the head's projected landmarks and sized from the head in texels, so it is one face at any
 * density: at the brand kit's size each eye a lid line over its iris under the brow, the nose's shadow and the mouth; at
 * twice that each eye's lash line, white and iris, the lid line, brows of the head's own shape, a nose with a lit bridge,
 * a shadow side and nostrils, lips with a darker upper lip and a lit lower one, the shadow under the jaw, the ear's bowl.
 * Its marks are the face's own colours, or steps along the skin's ramp from the painted tone so the key light still models
 * them. It draws on the head's skin alone: hair or a hand over it keep their own texels, and an eye under shades (a part
 * on the face that is neither skin nor hair) is not drawn at all, nor its lid, so no eye shows on the cheek under a lens.
 */
export interface FaceStamp {
  /** 0 front, ±1 three-quarter, ±2 profile, ±3 the back three-quarter (no face drawn); positive looks to the viewer's right. */
  view: number
  /** The face's half-width (texels): the nose's and the mouth's widths, which are the face's structure. */
  size: number
  /** An eye's width (texels), the density's size moved by the face's eyeSize (genes.ts): from 3 each has its white, below that
   * a lid line. */
  eye: number
  /** The eye's width before eyeSize: the face's level of detail (from 3 the white, the lid, the lips' two tones, the nose's
   * lit bridge, the marks), so a small head's narrow eye does not drop its whole face to the small drawing. */
  detail: number
  /** Projected (texels): the eye line's centre on the face, the eyes (screen-left first), the nose's underside and the
   * lips' line. (The ears are parts of their own: garments.ts ear.) */
  centre: P
  eyes: [P, P]
  nose: P
  mouth: P
  /** The head's frame in the cell, so the painter finds each face texel on the head's own form: its origin (texels, and
   * depth in m), the cell's texels a metre, the turn from view axes into the head's (row-major: x the figure's left,
   * y up from the chin, z forward), and the head's half-width, height, half-depth and the face's set (genes.faceAhead). */
  frame?: { o: [number, number, number]; ppm: number; R: number[]; head: [number, number, number, number] }
  /** The skin's material index, and the face's colours: iris, lash, the eyes' whites, brow, lips (upper, lower, corner). */
  skin: number
  iris: number
  lash: number
  white: number
  brow: number
  lips: [number, number, number]
  shape: HeadShape
  /** Marks the outfit leaves off (`eyes` garment: `nose: false`, `mouth: false`). */
  off?: ('nose' | 'mouth')[]
  /** The eyes drawn on the skin that shows below hair hanging over the eye row (`eyes` garment: `keep`), not left out. */
  keep?: boolean
  /** The eyes drawn as large as the head allows (`eyes` garment: `full`): from an eye of 6 texels. */
  full?: boolean
  blink: boolean
  /**
   * The mood's marks (figure.ts face tags): 'angry' the brows' inner ends down and the mouth's corners turned down;
   * 'smile' its corners up; 'dead' the lids heavy over flat eyes (the whites under the lid), the brows level; 'surprised'
   * the brows up; 'mouthOpen' (talking, a shout) the lips parted on the mouth's dark; 'lookL' / 'lookR' the irises to
   * the viewer's left or right, 'beside' the same as 'lookR' at this size (the eye has one texel to move).
   */
  mood?: Set<string>
}
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
): [number, number, number, number] {
  const t = p[1] / H,
    u = p[0] / hw,
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
      l = Math.hypot(...f)
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
  const l = Math.hypot(x, y, z) || 1
  return [x / l, y / l, z / l, most >= 0.5 ? front : 0]
}
/** A facet (facePlane) over the form's own normal `n`, `wf` of it the facet's. */
export function onForm(pl: readonly number[], n: readonly number[], wf: number) {
  const X = wf * pl[0] + (1 - wf) * n[0],
    Y = wf * pl[1] + (1 - wf) * n[1],
    Z = wf * pl[2] + (1 - wf) * n[2],
    m = Math.hypot(X, Y, Z) || 1
  return [X / m, Y / m, Z / m]
}

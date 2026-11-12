// biome-ignore-all lint/style/noNonNullAssertion: the compiler needs these assertions until the strict flags (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) replace each with a check

import type { Material } from '../body/parts'
import { RAMPS } from './duel-ramps'
import type { HandFormKind } from './paint-hand-form'
/**
 * The painter: a figure's colours as pixel-art sprites are made, so a procedural figure is a sprite cell drawn live,
 * which the lighting feature (src/shared/lighting) then lights from its normal map.
 *
 * - Every material has a short hand-picked ramp (light, mid, shadow, deep), snapped to DUEL.
 * - One painted key light, up and to the left, on normals smoothed over each part: clean clusters, mostly mid tone, a
 *   small light, a shadow side. Crevices (a nearer part beside) fall a tone.
 * - A warm near-black outline on the silhouette; where one part passes in front of another, a line in the far
 *   surface's own dark step. No fill is ink: a ramp that reaches it stops at its darkest step short of ink.
 * - The face is drawn on the lit head: placed from its landmarks, sized from its width, in its own colours and in
 *   steps along the skin's ramp.
 * - Out: the albedo, and a normal map (a normal's x, y, z as 0–255, alpha 0 where there is none) for the lighting.
 */
/** The outline's colour: DUEL black. */
export const INK = '#000000'
/** The painted key: up, left and toward the viewer (sprite space: x right, y up, z toward the camera). */
export const KEY = (() => {
  const v = [-0.5, 0.62, 0.6],
    l = Math.hypot(...v)
  return v.map((c) => c / l) as [number, number, number]
})()
/** The key a face is painted by: the key turned part way to the camera. */
export const FACE_KEY = (() => {
  const v = [KEY[0], KEY[1], KEY[2] + 0.25],
    l = Math.hypot(...v)
  return v.map((c) => c / l) as [number, number, number]
})()
export interface PaintStyle {
  /** Key-light thresholds between light | mid | shadow | deep. */
  tones: [number, number, number]
  /** Depth (m) at which a nearer part beside draws the ink line, and at which it casts a crevice tone. */
  line: number
  crevice: number
  /** Normal smoothing radius (texels), within a part. */
  smooth: number
  /** How far hair's strand clumps move it along its ramp. */
  strands: number
  /** Depth (m) within which the smoothing runs on across a join between parts of one region and cloth. */
  blend: number
  /** Cast shadow: how far (texels at density 1) a nearer part toward the key throws its shadow (the chin on the neck,
   * a fringe on the brow, an arm on the ribs), and the depth (m) it must stand clear of the surface by. */
  shadow: number
  shadowDepth: number
  /** The selective outline: on the side toward the key, each shape's own line tone (its deep tone darker still); on the
   * side away and underneath, ink. Off: ink all round. */
  selout: boolean
  /** Reflected light: the deep tone next to the outline on the shadow side lifts a tone, so a form turns, not flattens. */
  bounce: boolean
  /** A tone cluster smaller than this (texels at density 1, x density squared past it) joins its surroundings. */
  cluster: number
  /** Hue-shifted shadows: how far the shadow and deep tones lean cool (toward blue-violet, in OKLab b) before they snap
   * back to DUEL, so a black coat's shadow is navy rather than muddy; 0 keeps each ramp as picked. Warm ramps (skin,
   * browns, yellows) always keep theirs. */
  cool: number
  /** Cloth's broad folds: how far a slow noise on its surface moves its terminator (0 keeps the tones on the form). */
  folds: number
  /** A face's key-light thresholds on its planes (facePlane), and its tone budget whichever way it turns from the key:
   * the least and most shares of its skin in the light tone, and in shadow, so a face is mostly its mid tone. */
  face: [number, number, number]
  model: [number, number, number, number]
  /** A large surface's least share in shadow, its most in its light tone, and the size (texels at density 1, x density
   * squared past it) from which it counts as large. */
  surface: [number, number, number]
  /** The hands' form (paint-hand-form.ts); HAND_FORM where it is not given, so a sheet can draw the other beside it. */
  hand?: HandFormKind
}
export const PAINT: PaintStyle = {
  tones: [0.62, 0.05, -0.45],
  line: 0.03,
  crevice: 0.012,
  smooth: 1,
  strands: 0.9,
  blend: 0.03,
  shadow: 2,
  shadowDepth: 0.025,
  selout: true,
  bounce: true,
  cluster: 3,
  cool: 0.02,
  folds: 0.15,
  face: [0.78, 0.22, -0.4],
  model: [0.06, 0.1, 0.02, 0.08],
  surface: [0.25, 0.3, 24],
}

// ─── DUEL snapping (OKLab nearest, as scripts/duel-lut.py bakes the lookup) ───
const lin = (c: number) => {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}
export function oklab(rgb: number): [number, number, number] {
  const r = lin((rgb >> 16) & 255),
    g = lin((rgb >> 8) & 255),
    b = lin(rgb & 255)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b),
    m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b),
    s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}
export const DUEL = RAMPS.flat().map((c) => ({ c, lab: oklab(c) }))
const snapped = new Map<number, number>()
/** A colour's nearest DUEL colour. */
export function duel(rgb: number) {
  let hit = snapped.get(rgb)
  if (hit !== undefined) return hit
  const [L, A, B] = oklab(rgb)
  let best = Infinity
  for (const d of DUEL) {
    const e = (d.lab[0] - L) ** 2 + (d.lab[1] - A) ** 2 + (d.lab[2] - B) ** 2
    if (e < best) {
      best = e
      hit = d.c
    }
  }
  snapped.set(rgb, hit!)
  return hit!
}
/** The nearest DUEL colour to an OKLab colour. */
export function duelLab(L: number, A: number, B: number) {
  let best = Infinity,
    hit = 0
  for (const d of DUEL) {
    const e = (d.lab[0] - L) ** 2 + (d.lab[1] - A) ** 2 + (d.lab[2] - B) ** 2
    if (e < best) {
      best = e
      hit = d.c
    }
  }
  return hit
}
export const hex = (h: string) => parseInt(h.slice(1), 16)
/** Two ramps mixed tone by tone, `at` of the way from `from` to `to`: lightness and chroma in OKLab, the hue `to`'s, so
 * a fade's tiers run from the hair's dark into the wearer's own skin (never through a grey or a violet between them, as
 * a mix of the colours would), DUEL-snapped. */
export function mixTones(from: number[], to: number[], at: number) {
  return from.map((c, i) => {
    const a = oklab(c),
      b = oklab(to[Math.min(i, to.length - 1)]),
      hue = Math.atan2(b[2], b[1])
    const L = a[0] + (b[0] - a[0]) * at,
      C = Math.hypot(a[1], a[2]) + (Math.hypot(b[1], b[2]) - Math.hypot(a[1], a[2])) * at
    return duelLab(L, C * Math.cos(hue), C * Math.sin(hue))
  })
}
/** A material's four painted tones, DUEL-snapped; a blend (`mix`) mixed. */
export function tonesOf(m: Material): number[] {
  if (m.mix) return mixTones(m.mix.from.map(hex), m.mix.to.map(hex), m.mix.at)
  if (m.paint) return m.paint.map((h) => duel(hex(h)))
  const row = RAMPS[m.ramp],
    at = (o: number) => row[Math.max(0, Math.min(7, m.base + o))]
  return [at(1), at(0), at(-1), at(-2)]
}

/** A material's four painter tones as hex, light to deep, for a garment that mixes from them (a sheer leg over the
 * wearer's own skin): its `paint` ramp as it stands, else the four DUEL steps its row gives (a `mix` mixed). */
export function rampOf(m: Material): string[] {
  return m.paint ? [...m.paint] : tonesOf(m).map((c) => `#${c.toString(16).padStart(6, '0')}`)
}
/** The share levels of a sheer edge (`Material.mix.edge`): level 0 is the plain mix, level 3 the most the edge adds. */
export const EDGE_LEVELS = 4

// ─── Faces: drawn on the lit head, sized from it ───
/** The face's front planes (facePlane's last value: forehead and brow, bridge, each cheekbone's top, chin) and the share
 * of each in the light tone, its brightest: so the light lands on each as a shape of its own, as a pixel artist blocks
 * a face in, and the side of the head (temple, cheek, jaw) is a step down. */
export const LIGHT = [0, 0.14, 0.18, 0.12, 0.12, 0.18]
/** The share of a face in its deep tone: none. A sprite's face is flat, its skin mostly the mid with a soft shadow side
 * and a little light on its front planes (`model`, LIGHT); a deep tone on it reads as dirt at sprite size. */
export const FACE_DEEP = 0
/** The head's surface (garments.ts head): the drawn face goes on its skin and nowhere else. */
export const FACE_SEAM = 1000
/** Hair's seams (hair.ts HAIR_SEAM, and its ropes' own after it): a fringe over an eye is not shades. */
export const HAIR_SEAMS = [2000, 3000]
export type P = [x: number, y: number]

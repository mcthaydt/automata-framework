import { hypot } from '@automata/sim/math'
import { norm } from './vec.ts'
/** The painted key: up, left and toward the viewer (sprite space: x right, y up, z toward the camera). */
export const KEY: [number, number, number] = (() => {
  const v = [-0.5, 0.62, 0.6],
    l = norm(v)
  return v.map((c) => c / l) as [number, number, number]
})()
/** The key a face is painted by: the key turned part way to the camera. */
export const FACE_KEY: [number, number, number] = (() => {
  const v = [KEY[0], KEY[1], KEY[2] + 0.25],
    l = norm(v)
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
/** The key in the cell's own axes (x right, y down), toward the light: where a shadow's caster and a lit edge lie. */
export const K2: readonly [number, number] = (() => {
  const x = KEY[0],
    y = -KEY[1],
    l = hypot(x, y)
  return [x / l, y / l] as const
})()
/** How far a ray toward the key climbs (m) for each metre it runs across the cell. */
export const RISE: number = KEY[2] / hypot(KEY[0], KEY[1])
/** An outline texel's tone: ink, or (on the key's side of its shape) the shape's own line tone; and a dark ramp's rim. */
export const OUTLINE = 9
export const LINE = 10
export const RIM = 11
/** The hair's sheen band: the window of its surface's rise (the normal's y in view space) the band lies in. */
export const SHEEN = [0.64, 0.8] as const
/** A mirror lens's tint (holo `'mirror'`): its body a dark of its ramp's hue, lit and dark, and what shows through it
 * (`see`): an eye's white a muted step of that hue, its iris and lash the tint's dark. The tint's steps sit at MIRROR. */
export const MIRROR = 4
export const MIRROR_SKY = 0.4

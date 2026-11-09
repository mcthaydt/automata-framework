// A painted figure cell lit the way a pixel artist lights a sprite: the room's light once for the whole figure, and the
// normal map only to move a texel one step along its own DUEL ramp.
//
// - The flat light: the ambient plus each lamp at the figure's mean N·L (never under the style's `floor`), in the
//   sector's shade, stepped as the room's light is, times every texel. It sets how bright and how warm the figure is and
//   never shades across it. The floor is why a figure under a pendant is lit like the floor under it: a lamp overhead or
//   behind meets most of a figure's normals edge-on, and its mean N·L alone would leave it a silhouette. The floors add
//   up, so under several lamps they would light a figure hotter than its room: their sum is capped (`floorCap`), the
//   floor scaled down evenly. The cap lowers the floor only, never a light a figure faces.
// - The form: a texel whose normal faces the lamps clearly harder than the figure as a whole takes the next lighter step
//   of its ramp, one clearly turned away the next darker one. The painted bands stay; the lamp's side brightens them.
// - The rim: the silhouette's edge on the lamps' side takes the lighter step. A lamp's side is its direction in the cell's
//   2D frame (the picture plane), not its raw component: a pendant above and behind has little 2D part and still lights
//   the figure's top and its side. A lamp straight from the viewer or from behind has none (`RIM_SIDE`) and rims nothing.
// - A stepped texel alone among its own colour's texels goes back to their step, so the bands keep clean edges.
//
// The ink, the eyes and the outline never step. The painter draws its own outline, so nothing is grown outside the
// figure: a transparent texel stays transparent. Every colour that comes out is a DUEL colour, with no dither.

import { duel } from '../../../shared/math/duel.ts'
import { stepLight } from '../../../shared/render/texel.ts'
import { RAMP_OUTLINE, RAMPS } from '../paint/duel-snap.ts'
import type { PaintedCell } from '../paint/paint-cell.ts'

type V3 = readonly [number, number, number]

/** A light on a sprite: its direction toward the light in the cell's normal-map frame (unit), and its colour times how
 * much of it reaches the figure, in light units. */
export interface SpriteLamp {
  readonly dir: V3
  readonly rgb: V3
}

/** How a texel steps: `threshold` (0 to 1 of the lamps' total strength) a texel's own N·L must clear the figure's mean
 * by; `ink`, the peak channel at or under which a texel never steps (the ink, the eyes); `floor`, a lamp's least share of
 * the figure in the flat light; `rim`, the share of the lamps' total strength that an edge's outward direction must take,
 * in the cell's 2D frame, for the edge to rim; `floorCap`, the most the floors may add up to (strength times `floor`, in
 * light units), above which the floor is scaled down evenly. */
export interface SpriteStyle {
  readonly threshold: number
  readonly ink: number
  readonly floor: number
  readonly rim: number
  readonly floorCap: number
}

export const SPRITE_STYLE: SpriteStyle = { threshold: 0.22, ink: 40, floor: 0.5, rim: 0.35, floorCap: 0.8 }

/** A lamp whose 2D part (x, y in the cell's frame) is under this gives no rim: within 14.5° of the view axis, from the
 * viewer or from behind, it has no side to light. */
export const RIM_SIDE = 0.25

/** The least alpha a figure's texel keeps: the light clears every texel under it, a faint edge is not part of the figure. */
export const OPAQUE = 128

/** `step` and `max` are the room's light; `shade` the sector's, as a factor (1: none). */
export interface SpriteOptions {
  readonly step: number
  readonly max: number
  readonly shade?: number | undefined
  readonly style?: SpriteStyle | undefined
}

const strength = (rgb: V3): number => Math.max(rgb[0], rgb[1], rgb[2])
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const byte = (a: Uint8ClampedArray, i: number): number => a[i] ?? 0

/** Where a painted colour sits on the DUEL ramps: its row and step. A colour off the ramps takes the nearest entry. */
const places = new Map<number, readonly [number, number]>()
function onRamp(rgb: number): readonly [number, number] {
  const known = places.get(rgb)
  if (known) return known
  let best = Number.POSITIVE_INFINITY
  let found: readonly [number, number] = [0, 0]
  for (let r = 0; r < RAMPS.length; r++) {
    const row = RAMPS[r] ?? []
    for (let i = 0; i < row.length; i++) {
      const c = row[i] ?? 0
      const dr = (c >> 16) - (rgb >> 16)
      const dg = ((c >> 8) & 255) - ((rgb >> 8) & 255)
      const db = (c & 255) - (rgb & 255)
      const d = dr * dr + dg * dg + db * db
      if (d < best) {
        best = d
        found = [r, i]
      }
    }
  }
  places.set(rgb, found)
  return found
}

/** A texel's normal from the cell's normal map (red right, green down the image, blue toward the camera); a texel with
 * none faces the camera. */
function normalAt(normals: Uint8ClampedArray, k: number): V3 {
  if (!byte(normals, k * 4 + 3)) return [0, 0, 1]
  return [
    byte(normals, k * 4) / 127.5 - 1,
    1 - byte(normals, k * 4 + 1) / 127.5,
    byte(normals, k * 4 + 2) / 127.5 - 1,
  ]
}

/** Each lamp's N·L over the figure's filled texels that have a normal, averaged (0 with none). */
function meanFacing(cell: PaintedCell, lamps: readonly SpriteLamp[]): number[] {
  const { colours, normals, width, height } = cell
  const mean = lamps.map(() => 0)
  let count = 0
  for (let k = 0; k < width * height; k++) {
    if (byte(colours, k * 4 + 3) < OPAQUE || !byte(normals, k * 4 + 3)) continue
    const n = normalAt(normals, k)
    count++
    lamps.forEach(({ dir }, i) => {
      mean[i] = (mean[i] ?? 0) + Math.max(0, dot(n, dir))
    })
  }
  return mean.map((m) => (count ? m / count : 0))
}

/** The flat light: (ambient + the sum of max(mean N·L, floor) times rgb) times shade, clamped to `max`, stepped. The floor
 * is the style's, scaled down so the lamps' floors add up to at most `floorCap`. */
export function flatLight(
  cell: PaintedCell,
  lamps: readonly SpriteLamp[],
  ambient: V3,
  options: SpriteOptions,
  mean: readonly number[] = meanFacing(cell, lamps),
): V3 {
  const sum: [number, number, number] = [ambient[0], ambient[1], ambient[2]]
  const shade = options.shade ?? 1
  const style = options.style ?? SPRITE_STYLE
  const want = lamps.reduce((t, { rgb }) => t + strength(rgb) * style.floor, 0)
  const floor = want > style.floorCap ? (style.floor * style.floorCap) / want : style.floor
  lamps.forEach(({ rgb }, i) => {
    for (const c of [0, 1, 2] as const) sum[c] += Math.max(mean[i] ?? 0, floor) * rgb[c]
  })
  const cap = (v: number): number => Math.min(options.max, v * shade)
  return stepLight([cap(sum[0]), cap(sum[1]), cap(sum[2])], options.step)
}

/** The step each texel takes, −1, 0 or +1: its form against the figure's, the rim, and then the clean-edge pass. */
function stepsOf(
  cell: PaintedCell,
  lamps: readonly SpriteLamp[],
  style: SpriteStyle,
  mean: readonly number[],
) {
  const { colours, normals, width: w, height: h } = cell
  const filled = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < w && y < h && byte(colours, (y * w + x) * 4 + 3) >= OPAQUE
  const rgbAt = (k: number): number =>
    (byte(colours, k * 4) << 16) | (byte(colours, k * 4 + 1) << 8) | byte(colours, k * 4 + 2)
  // `facing` is the figure's mean in lamp strength (what a texel's own light is measured against), `total` the lamps'
  // strength (it scales the threshold).
  const total = lamps.reduce((t, { rgb }) => t + strength(rgb), 0)
  const facing = lamps.reduce((t, { rgb }, i) => t + (mean[i] ?? 0) * strength(rgb), 0)
  const threshold = style.threshold * Math.max(total, 1e-6)
  // How much of the lamps' strength lies toward an outward direction in the picture plane: each lamp counts by its
  // strength times the cosine between its 2D direction and the outward one, and not at all within `RIM_SIDE` of the axis.
  const sideOf = (ox: number, oy: number): number =>
    lamps.reduce((s, { dir, rgb }) => {
      const q = Math.sqrt(dir[0] * dir[0] + dir[1] * dir[1])
      return q < RIM_SIDE ? s : s + strength(rgb) * Math.max(0, (ox * dir[0] + oy * dir[1]) / q)
    }, 0)
  const litBy = (n: V3): number =>
    lamps.reduce((s, { dir, rgb }) => s + Math.max(0, dot(n, dir)) * strength(rgb), 0)
  // Ink, outline and eyes: a texel that never steps.
  const never = (k: number): boolean => {
    const rgb = rgbAt(k)
    const peak = Math.max(byte(colours, k * 4), byte(colours, k * 4 + 1), byte(colours, k * 4 + 2))
    return byte(colours, k * 4 + 3) < OPAQUE || peak <= style.ink || rgb === RAMP_OUTLINE || rgb === 0
  }
  const step = new Int8Array(w * h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = y * w + x
      if (never(k)) continue
      const d = litBy(normalAt(normals, k)) - facing
      let s = d > threshold ? 1 : d < -threshold ? -1 : 0
      // The rim: an edge texel whose outward direction is on the lamps' side in the picture plane, by a share of their
      // total strength (north is y − 1).
      const e = filled(x + 1, y)
      const west = filled(x - 1, y)
      const south = filled(x, y + 1)
      const north = filled(x, y - 1)
      if (!(e && west && south && north)) {
        const ox = (west ? 0 : -1) + (e ? 0 : 1)
        const oy = (north ? 0 : 1) + (south ? 0 : -1)
        const l = Math.sqrt(ox * ox + oy * oy)
        if (l > 0 && sideOf(ox / l, oy / l) >= style.rim * Math.max(total, 1e-6)) s = 1
      }
      step[k] = s
    }
  // Clean edges: a texel stepped unlike every same-coloured neighbour takes theirs.
  const settled = step.slice()
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = y * w + x
      if (never(k)) continue
      const rgb = rgbAt(k)
      let same = 0
      let agree = 0
      let other = 0
      for (const q of [
        x > 0 ? k - 1 : -1,
        x < w - 1 ? k + 1 : -1,
        y > 0 ? k - w : -1,
        y < h - 1 ? k + w : -1,
      ]) {
        if (q < 0 || byte(colours, q * 4 + 3) < OPAQUE || rgbAt(q) !== rgb) continue
        same++
        if (step[q] === step[k]) agree++
        else other += step[q] ?? 0
      }
      if (same >= 2 && agree === 0) settled[k] = Math.sign(other)
    }
  return settled
}

/** Lights a painted cell from its normal map: every texel snapped to DUEL, transparent ones left empty. */
export function lightCell(
  cell: PaintedCell,
  lamps: readonly SpriteLamp[],
  ambient: V3,
  options: SpriteOptions,
): PaintedCell {
  const { colours, width, height } = cell
  const style = options.style ?? SPRITE_STYLE
  const mean = meanFacing(cell, lamps)
  const flat = flatLight(cell, lamps, ambient, options, mean)
  const settled = stepsOf(cell, lamps, style, mean)
  const out = new Uint8ClampedArray(width * height * 4)
  const clamp = (v: number): number => Math.min(255, Math.max(0, Math.round(v)))
  for (let k = 0; k < width * height; k++) {
    const o = k * 4
    if (byte(colours, o + 3) < OPAQUE) continue
    let rgb = (byte(colours, o) << 16) | (byte(colours, o + 1) << 8) | byte(colours, o + 2)
    const stepped = settled[k] ?? 0
    if (stepped) {
      const [r, i] = onRamp(rgb)
      const row = RAMPS[r] ?? []
      rgb = row[Math.max(0, Math.min(row.length - 1, i + stepped))] ?? rgb
    }
    const snapped = duel(
      (clamp((rgb >> 16) * flat[0]) << 16) |
        (clamp(((rgb >> 8) & 255) * flat[1]) << 8) |
        clamp((rgb & 255) * flat[2]),
    )
    out[o] = snapped >> 16
    out[o + 1] = (snapped >> 8) & 255
    out[o + 2] = snapped & 255
    out[o + 3] = byte(colours, o + 3)
  }
  return { ...cell, colours: out }
}

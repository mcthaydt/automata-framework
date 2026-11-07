// A figure lit the way a pixel artist lights a sprite (The Last Light's ramp light; EnvironmentBuilder
// `stage/sprite-light.ts` is the source): the room's light once for the whole figure, and the surface normal only to
// move a part one step along its own ramp. - The flat light: the time's ambient plus each lamp at the figure's mean N·L
// (never under the floor), stepped as the room's light is, times every part. It sets how bright and warm the figure is
// and never shades across it. The floor is why a figure under a pendant is lit like the floor under it: a lamp overhead
// meets most of a figure's normals edge-on, and its mean N·L alone would leave the figure a silhouette. The floors add
// up, so under several lamps they are capped (`floorCap`) and scaled down evenly. - The form: a part whose normal faces
// the lamps clearly harder than the figure as a whole takes the next lighter step, one clearly turned away the next
// darker one. - The rim: the silhouette's edge on the lamps' side takes the lighter step. A lamp's side is its direction
// in the picture plane (x, y), not its raw component, and a lamp straight from the viewer or from behind has none. A
// pure function over the lamps and the figure's normals, so a view applies it to whatever it draws and a test reads it.

import type { TimeOfDay } from '../../shared/time-of-day/time-of-day.ts'

type V3 = readonly [number, number, number]

/** A lamp on a figure: its direction toward the light in view space (unit) and its colour times how much reaches it. */
export interface SpriteLamp {
  readonly dir: V3
  readonly rgb: V3
}

/** How a figure steps. The source's values, each its own named rule. */
export const SPRITE_STYLE = {
  /** The share of the lamps' strength a part's own N·L must clear the figure's mean by to step. */
  threshold: 0.22,
  /** A lamp's least share of the figure in the flat light. */
  floor: 0.5,
  /** The share of the lamps' strength an edge's outward direction must take to rim. */
  rim: 0.35,
  /** The most the lamps' floors may add up to (sum of strength times floor). */
  floorCap: 0.8,
  /** A lamp whose picture-plane part is under this (within 14.5° of the view axis) gives no rim. */
  rimSide: 0.25,
  /** The room's light is cut into multiples of this, and never over `max`. */
  lightStep: 0.1,
  max: 1.6,
} as const

export interface SpriteInput {
  readonly lamps: readonly SpriteLamp[]
  /** The normals of the figure's parts, from which its mean facing to each lamp is found. */
  readonly chestNormals: readonly V3[]
}

export interface SpriteLight {
  /** The flat light's colour, in light units: multiply each part's colour by it. */
  readonly flat: V3
  /** -1, 0 or 1: the step a part facing `normal` takes along its ramp. */
  form(normal: V3): -1 | 0 | 1
  /** Whether an edge whose outward direction in the picture plane is (`ox`, `oy`) takes the lighter step. */
  rim(ox: number, oy: number): boolean
}

const strength = (rgb: V3): number => Math.max(rgb[0], rgb[1], rgb[2])
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const channel = (hex: string, shift: number): number =>
  ((Number.parseInt(hex.slice(1), 16) >> shift) & 0xff) / 255

/** The time's ambient light as a colour: its level times its tint. */
function ambientOf(time: TimeOfDay): V3 {
  const { level, tint } = time.scene.light.ambient
  return [channel(tint, 16) * level, channel(tint, 8) * level, channel(tint, 0) * level]
}

const stepped = (v: number): number =>
  Math.round(Math.min(SPRITE_STYLE.max, v) / SPRITE_STYLE.lightStep) * SPRITE_STYLE.lightStep

/** The sprite light of a figure under `input.lamps` at `time`. */
export function spriteLight(input: SpriteInput, time: TimeOfDay): SpriteLight {
  const { lamps, chestNormals } = input
  const mean = lamps.map(({ dir }) => {
    if (chestNormals.length === 0) return 0
    let sum = 0
    for (const n of chestNormals) sum += Math.max(0, dot(n, dir))
    return sum / chestNormals.length
  })
  const total = lamps.reduce((t, { rgb }) => t + strength(rgb), 0)
  const want = total * SPRITE_STYLE.floor
  const floor =
    want > SPRITE_STYLE.floorCap ? (SPRITE_STYLE.floor * SPRITE_STYLE.floorCap) / want : SPRITE_STYLE.floor
  const sum = [...ambientOf(time)]
  lamps.forEach(({ rgb }, i) => {
    const share = Math.max(mean[i] as number, floor)
    for (let c = 0; c < 3; c++) sum[c] = (sum[c] as number) + share * rgb[c as 0 | 1 | 2]
  })
  const flat: V3 = [stepped(sum[0] as number), stepped(sum[1] as number), stepped(sum[2] as number)]
  const facing = lamps.reduce((t, { rgb }, i) => t + (mean[i] as number) * strength(rgb), 0)
  const threshold = SPRITE_STYLE.threshold * Math.max(total, 1e-6)
  const litBy = (n: V3): number =>
    lamps.reduce((s, { dir, rgb }) => s + Math.max(0, dot(n, dir)) * strength(rgb), 0)
  return {
    flat,
    form(normal) {
      const d = litBy(normal) - facing
      return d > threshold ? 1 : d < -threshold ? -1 : 0
    },
    rim(ox, oy) {
      const length = Math.sqrt(ox * ox + oy * oy)
      if (length === 0) return false
      const side = lamps.reduce((s, { dir, rgb }) => {
        const q = Math.sqrt(dir[0] * dir[0] + dir[1] * dir[1])
        return q < SPRITE_STYLE.rimSide
          ? s
          : s + strength(rgb) * Math.max(0, (ox * dir[0] + oy * dir[1]) / (q * length))
      }, 0)
      return side >= SPRITE_STYLE.rim * Math.max(total, 1e-6)
    },
  }
}

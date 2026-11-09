// The light of a scene as a pixel artist's room has it: not the physical sum of a hemisphere and some lamps, but a base (an
// ambient with a small key on the normal, a fill on upright surfaces fading with height, and the sun where nothing is in
// its way) plus each lamp's reach, all in the colours as drawn (sRGB, multiplying a texel's colour), clamped to a ceiling
// and cut into whole steps. A scene given a model is baked this way (`vertex-bake.ts`); one without keeps the physical sum.

import { stepLight } from '../texel.ts'

type V3 = readonly [number, number, number]

/** The base light, the lamps' strength and the steps the sum is cut into. Colours are channels 0 to 1 as drawn. */
export interface LightModel {
  /** The steps light is cut into, and the ceiling a channel never passes. */
  readonly step: number
  readonly max: number
  /** A lamp's colour times this times its level, at the lamp's own distance falloff. */
  readonly strength: number
  readonly ambient: { readonly level: number; readonly tint: V3 }
  /** The fill on upright surfaces: it fades from `fade[0]` at the floor by `fade[1]` metres of height, never under `fade[2]`. */
  readonly fill: { readonly level: number; readonly tint: V3; readonly fade: V3 }
  /** The small key on the normal that gives an ambient a side to be brighter on. */
  readonly key: { readonly dir: V3; readonly level: number }
  /** The sun: its direction toward it (unit) and its colour times its level; where it casts shadows. */
  readonly sun?: { readonly dir: V3; readonly rgb: V3; readonly shadows: boolean } | undefined
  /** The floor's height, for the fill's fade. */
  readonly floor?: number | undefined
}

const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/**
 * The light that does not move at a point, before the sun: the ambient with its key on the normal and the fill on upright
 * surfaces, both times how open the point is (`open`, 0 to 1).
 */
export function baseLight(model: LightModel, y: number, normal: V3, open: number): [number, number, number] {
  const key = model.ambient.level + Math.max(0, dot(normal, model.key.dir)) * model.key.level
  const [start, over, least] = model.fill.fade
  const fade = Math.max(least, Math.min(1, start - (y - (model.floor ?? 0)) / over))
  const fill = (1 - Math.abs(normal[1])) * model.fill.level * fade
  const channel = (c: 0 | 1 | 2): number => open * (key * model.ambient.tint[c] + fill * model.fill.tint[c])
  return [channel(0), channel(1), channel(2)]
}

/** What the sun adds at a point it reaches: its colour times how squarely it strikes. */
export function sunLight(model: LightModel, normal: V3): [number, number, number] {
  const sun = model.sun
  const strike = sun === undefined ? 0 : Math.max(0, dot(normal, sun.dir))
  return sun === undefined ? [0, 0, 0] : [sun.rgb[0] * strike, sun.rgb[1] * strike, sun.rgb[2] * strike]
}

/** A sum of light, shaded, held under the ceiling a channel and cut into steps. */
export function finishLight(model: LightModel, sum: V3, shade: number): [number, number, number] {
  const { max, step } = model
  const held: V3 = [
    Math.min(max, sum[0] * shade),
    Math.min(max, sum[1] * shade),
    Math.min(max, sum[2] * shade),
  ]
  const out = stepLight(held, step)
  return [out[0], out[1], out[2]]
}

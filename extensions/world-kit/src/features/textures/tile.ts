// A tile: the labels of a photo turned into a few clean texels (pipeline.ts), the one format a textured swatch is drawn
// from. `photoToTile` is the whole pipeline on a photo's bytes; `tileColours` reads a tile's labels against a swatch's
// ladder and gives palette indices, so every texel of a tile is a DUEL colour.

import { STEPS } from './colour.ts'
import {
  clean,
  facet,
  flatten,
  indexPhoto,
  indexTone,
  type Lab,
  labOf,
  resample,
  turned,
  wear,
} from './pipeline.ts'
import { decodePng } from './png.ts'
import { TEXTURE_DEFAULTS, type TextureSpec, texelScale } from './texture-spec.ts'

/** The labels of a tile, `width` × `height`, each `slot * 16 + value` (pipeline.ts). */
export interface Tile {
  readonly width: number
  readonly height: number
  readonly labels: Uint16Array
}

/** A label's tone offset (slots 0 and 1) or ramp step (slot 2 and up), and its slot. */
export function unpack(label: number): { value: number; slot: number } {
  const slot = label >> 4
  return { value: slot < 2 ? (label & 15) - 8 : label & 15, slot }
}

/** What a photo is: its pixels and how many metres it spans. */
export interface PhotoSource {
  readonly lab: Lab
  /** Width and height in metres. */
  readonly size: readonly [number, number]
}

/** The photo's metres across and its texel scale along u and v: the tile is as many texels as a surface of that size shows. */
export interface TileScale {
  /** Texels a metre along u and along v; snapped to the pipeline's √2 steps. */
  readonly texels: readonly [number, number]
}

/** A tile from a photo that is already read, flattened and faceted as `spec` says (`photoToTile` does both). */
export function tileFromLab(source: PhotoSource, spec: Omit<TextureSpec, 'photo'>, scale: TileScale): Tile {
  const d = TEXTURE_DEFAULTS
  let lab = source.lab
  let [metresU, metresV] = source.size.map((m) => m * (spec.scale ?? d.scale)) as [number, number]
  if (spec.turn) {
    lab = turned(lab)
    ;[metresU, metresV] = [metresV, metresU]
  }
  const [lu, lv] = [texelScale(scale.texels[0]), texelScale(scale.texels[1])]
  const width = Math.max(2, Math.round(metresU * lu))
  const height = Math.max(2, Math.round(metresV * lv))
  const small = resample(lab, width, height)
  const range = spec.range ?? d.range
  const photo = spec.colour === 'photo'
  const labels = photo
    ? indexPhoto(small, spec.colours ?? d.colours)
    : indexTone(small, {
        contrast: spec.contrast ?? d.contrast,
        range,
        accent: spec.accent ?? d.accent,
      })
  // Wear keeps a tone inside its range (a ramp step stays on its ramp, 0 at the darkest).
  wear(labels, width, height, spec.wear ?? d.wear, (spec.seed ?? d.seed) * 31 + 7, photo ? 0 : range[0] + 8)
  clean(labels, width, height, spec.cluster ?? d.cluster)
  return { width, height, labels }
}

/** The knobs `photoToTile` takes: the texture's, and the photo's size and the texel scale it is seen at. */
export interface PhotoKnobs extends Omit<TextureSpec, 'photo'> {
  /** The metres the photo spans, width and height. */
  readonly size: readonly [number, number]
  /** Texels a metre along u and v (default 32 both). */
  readonly texels?: readonly [number, number] | undefined
}

/** A tile from a PNG's bytes: reads it, flattens and facets it, scales it down to the texel scale, indexes it, wears and
 * cleans it. The same bytes and knobs give the same tile on every machine. */
export function photoToTile(png: Uint8Array, knobs: PhotoKnobs): Tile {
  const d = TEXTURE_DEFAULTS
  const raw = labOf(decodePng(png))
  const flat = flatten(raw, Math.max(raw.width, raw.height) / 8, knobs.flatten ?? d.flatten)
  const lab = facet(flat, knobs.facet ?? d.facet)
  return tileFromLab({ lab, size: knobs.size }, knobs, { texels: knobs.texels ?? [32, 32] })
}

/** The swatch a tile's labels are read against: its ramp and step (slot 0), and its accent's (slot 1). */
export interface Ladder {
  /** The ramp row, 0 to 31, and the step on it, 0 to 7. */
  readonly base: { readonly ramp: number; readonly step: number }
  readonly accent?: { readonly ramp: number; readonly step: number } | undefined
}

/** Each texel as a palette index: a tone label is a step offset on the ladder (clamped to the ramp's ends), a photo label
 * a step of its own ramp. */
export function tileColours(tile: Tile, ladder: Ladder): Uint8Array {
  const out = new Uint8Array(tile.labels.length)
  tile.labels.forEach((label, i) => {
    const { value, slot } = unpack(label)
    const on = slot === 0 ? ladder.base : slot === 1 ? (ladder.accent ?? ladder.base) : undefined
    const ramp = on === undefined ? slot - 2 : on.ramp
    const step = on === undefined ? value : Math.max(0, Math.min(STEPS - 1, on.step + value))
    out[i] = ramp * STEPS + step
  })
  return out
}

// Reading a tile's labels: a tile, and its labels against a swatch's ladder as palette indices. Free of the photo pipeline
// (which needs Node's zlib), so a browser bundle can hold it.
import { STEPS } from './colour.ts'

/** The labels of a tile, `width` × `height`, each `slot * 16 + value` (pipeline.ts). */
export interface Tile {
  readonly width: number
  readonly height: number
  readonly labels: Uint16Array
}

/** The slot of a joint texel (grout between tiles, mortar): above the 32 photo-mode ramps' slots (2 to 33), so no tile made
 * without a joint colour holds one. Its value is a tone offset like slots 0 and 1's, on the joint swatch's step. */
export const JOINT_SLOT = 40

/** A label's tone offset (slots 0, 1 and the joint's) or ramp step (the photo ramps' slots), and its slot. */
export function unpack(label: number): { value: number; slot: number } {
  const slot = label >> 4
  return { value: slot < 2 || slot === JOINT_SLOT ? (label & 15) - 8 : label & 15, slot }
}

/** The swatch a tile's labels are read against: its ramp and step (slot 0), its accent's (slot 1) and its joint's. */
export interface Ladder {
  /** The ramp row, 0 to 31, and the step on it, 0 to 7. */
  readonly base: { readonly ramp: number; readonly step: number }
  readonly accent?: { readonly ramp: number; readonly step: number } | undefined
  readonly joint?: { readonly ramp: number; readonly step: number } | undefined
}

/** Each texel as a palette index: a tone label is a step offset on the ladder (clamped to the ramp's ends), a photo label
 * a step of its own ramp. */
export function tileColours(tile: Tile, ladder: Ladder): Uint8Array {
  const out = new Uint8Array(tile.labels.length)
  tile.labels.forEach((label, i) => {
    const { value, slot } = unpack(label)
    const on =
      slot === 0
        ? ladder.base
        : slot === 1
          ? (ladder.accent ?? ladder.base)
          : slot === JOINT_SLOT
            ? (ladder.joint ?? ladder.base)
            : undefined
    const ramp = on === undefined ? slot - 2 : on.ramp
    const step = on === undefined ? value : Math.max(0, Math.min(STEPS - 1, on.step + value))
    out[i] = ramp * STEPS + step
  })
  return out
}

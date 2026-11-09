// A lit cell on its way to the screen: each texel hazed toward the veil the scene has at the figure's depth (lit by the
// light there), then snapped to DUEL with the dither of the screen texel it lands on, so a figure in haze is made of the
// same colours as the room behind it. Ink stays ink. A figure that stands in one light repaints nothing: the result is kept
// for the cell, and asked again with a light within one step, a haze within 1/32 and the same place on the Bayer grid, it
// is the same array.

import { type Haze, hazed, litColour, snapTexel } from '../../../shared/render/texel.ts'
import type { PaintedCell } from '../paint/paint-cell.ts'

type V3 = readonly [number, number, number]

/** What finishing a cell reads of the look. */
export interface FinishLook {
  readonly haze: Haze
  readonly dither: { readonly strength: number }
  readonly light: { readonly step: number }
}

/** The haze is kept to this many shares, so a slow change in it paints once a share, not once a frame. */
const SHARES = 32

const finishes = new WeakMap<PaintedCell, Map<string, Uint8ClampedArray>>()

/**
 * `cell`'s colours as they land on the screen with its top-left texel at `place` (screen texels): hazed by `share`
 * toward the veil lit by `light`, then snapped. With no haze the cell's own colours are returned.
 */
export function finishCell(
  cell: PaintedCell,
  light: V3,
  share: number,
  place: readonly [number, number],
  look: FinishLook,
): Uint8ClampedArray {
  const steps = Math.round(Math.min(1, Math.max(0, share)) * SHARES)
  if (steps === 0) return cell.colours
  const { step } = look.light
  const lit: V3 = [
    Math.round(light[0] / step) * step,
    Math.round(light[1] / step) * step,
    Math.round(light[2] / step) * step,
  ]
  const px = place[0] & 3
  const py = place[1] & 3
  const key = `${lit.join(',')}|${steps}|${px}|${py}`
  const kept = finishes.get(cell) ?? new Map<string, Uint8ClampedArray>()
  finishes.set(cell, kept)
  const known = kept.get(key)
  if (known) return known
  const { width, height, colours } = cell
  const out = new Uint8ClampedArray(colours.length)
  const amount = steps / SHARES
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4
      const alpha = colours[o + 3] ?? 0
      if (!alpha) continue
      let rgb = ((colours[o] ?? 0) << 16) | ((colours[o + 1] ?? 0) << 8) | (colours[o + 2] ?? 0)
      if (rgb !== 0)
        rgb = snapTexel(
          hazed(litColour(rgb, [1, 1, 1], 1), lit, amount, look.haze),
          px + x,
          py + y,
          look.dither.strength,
        )
      out[o] = rgb >> 16
      out[o + 1] = (rgb >> 8) & 255
      out[o + 2] = rgb & 255
      out[o + 3] = alpha
    }
  kept.set(key, out)
  return out
}

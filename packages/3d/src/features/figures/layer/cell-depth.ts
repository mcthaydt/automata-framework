// A painted cell's depth as the composite pass reads it: metres toward the camera from the figure's root, in two 8-bit
// channels (high byte in red, low in green), one RGBA texel for each of the cell's.

import { packDepth, packedDepthBytes } from '../../../shared/render/alpha/alpha-codes.ts'
import type { PaintedCell } from '../paint/paint-cell.ts'

/**
 * The depth texels of `cell`. A texel the painter outlined has no depth of its own; it takes its nearest filled
 * neighbour's, so the outline stands where the figure does. An empty texel is flat, since the pass discards it by colour.
 */
export function depthBytes(
  cell: PaintedCell,
  out: Uint8Array<ArrayBuffer> = new Uint8Array(cell.width * cell.height * 4),
): Uint8Array<ArrayBuffer> {
  const { width, height, depth, colours } = cell
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const k = y * width + x
      let metres = depth[k] ?? Number.NEGATIVE_INFINITY
      if (!(metres > Number.NEGATIVE_INFINITY) && (colours[k * 4 + 3] ?? 0) > 0)
        for (const q of [k - 1, k + 1, k - width, k + width]) {
          const near =
            q >= 0 && q < depth.length ? (depth[q] ?? Number.NEGATIVE_INFINITY) : Number.NEGATIVE_INFINITY
          if (near > Number.NEGATIVE_INFINITY) {
            metres = near
            break
          }
        }
      const [hi, lo] = packedDepthBytes(packDepth(metres > Number.NEGATIVE_INFINITY ? metres : 0))
      out[k * 4] = hi
      out[k * 4 + 1] = lo
      out[k * 4 + 2] = 0
      out[k * 4 + 3] = 255
    }
  return out
}

// The DUEL snap's candidate table. The snap sends a colour plus a 4 × 4 Bayer offset to its nearest palette colour, and the
// offset is the same on all three channels, so the pick is the palette colour nearest the point `colour + t · (1, 1, 1)`
// for one of sixteen `t`. A table of finished answers would need sixteen 256³ entries, so this one holds, for each cell of a
// coarse grid over the colour cube, the short list of palette colours that can be nearest to any point the cell and the
// dither reach, in palette order. The shader then runs the loop it always ran, over that list instead of all 256: the same
// distance sums, the same strict `<`, the same first-index tie-break, so the answer is the loop's by construction.
//
// A colour `j` is dropped from a cell's list only when another colour is nearer than it to EVERY point of the cell swept
// along the dither (a linear test, checked at the sweep's corners) by more than `SLACK`, which is far above what 32-bit
// arithmetic can blur. The cell is widened by `MARGIN` so a colour that rounds into the next cell still finds its own colour.

import { DEFAULT_PALETTE } from '@automata/content/palette'
import { BAYER, EXACT } from './duel-snap.ts'

/** Cells along each axis of the table. */
export const GRID: number = 16
/** Squared distance a colour must be nearer by, over the whole cell, to be dropped (float32 error on a sum is about 5e-7). */
const SLACK: number = 1e-5
/** How far past its edges a cell is taken to reach, so a colour on the edge or rounded across it still has its candidates. */
const MARGIN: number = 1 / 8192

/** The palette as the shader holds it: each channel as `toFixed(4)` prints it, in palette order. */
export const SHADER_PALETTE: readonly (readonly [number, number, number])[] = DEFAULT_PALETTE.colors.map(
  (hex) => {
    const c = Number.parseInt(hex.slice(1), 16)
    return [16, 8, 0].map((shift) => Number((((c >> shift) & 0xff) / 255).toFixed(4))) as [
      number,
      number,
      number,
    ]
  },
)

/** The offset every channel gets in Bayer cell `cell`, in colour units. */
export const offsetOf = (cell: number, strength: number): number =>
  ((BAYER[cell] as number) / 16 - 0.5) * strength

/** The index of the palette colour the shader's 256-colour loop gives `rgb` (0 to 1 a channel) in Bayer cell `cell`. */
export function referenceSnap(
  rgb: readonly [number, number, number],
  cell: number,
  strength: number,
): number {
  const off = offsetOf(cell, strength)
  let best = 1e9
  let pick = -1
  let exact = 1e9
  let same = -1
  SHADER_PALETTE.forEach((p, i) => {
    const e = (p[0] - (rgb[0] + off)) ** 2 + (p[1] - (rgb[1] + off)) ** 2 + (p[2] - (rgb[2] + off)) ** 2
    if (e < best) {
      best = e
      pick = i
    }
    const x = (p[0] - rgb[0]) ** 2 + (p[1] - rgb[1]) ** 2 + (p[2] - rgb[2]) ** 2
    if (x < exact) {
      exact = x
      same = i
    }
  })
  return exact < EXACT ? same : pick
}

/** The candidate lists for one dither strength, and the texels the shader reads them from. */
export interface CandidateTable {
  readonly strength: number
  /** Most candidates in any cell. */
  readonly maxCount: number
  /** RGBA8 texels a cell takes: its count, then its candidates, four to a texel. */
  readonly groups: number
  /** Texture size: `GRID * GRID` wide, `GRID * groups` tall. The cell (r, g, b) is at x = r + GRID·g, y = b·groups. */
  readonly width: number
  readonly height: number
  /** The texels, row by row: byte 0 of a cell's first texel is its count less one, then the palette indices. */
  readonly data: Uint8Array
  /** The candidates of cell `cell` (r + GRID·(g + GRID·b)), palette indices in order. */
  candidates(cell: number): readonly number[]
}

/** The cell index of a colour: each channel's `floor(v · GRID)`, held inside the grid. */
export const cellOf = (rgb: readonly [number, number, number]): number => {
  const at = (v: number): number => Math.min(GRID - 1, Math.max(0, Math.floor(v * GRID)))
  return at(rgb[0]) + GRID * (at(rgb[1]) + GRID * at(rgb[2]))
}

/** The index the table's path gives `rgb` in Bayer cell `cell`: the loop, over the cell's candidates only. */
export function tableSnap(
  table: CandidateTable,
  rgb: readonly [number, number, number],
  cell: number,
  strength: number,
): number {
  const off = offsetOf(cell, strength)
  let best = 1e9
  let pick = -1
  let exact = 1e9
  let same = -1
  for (const i of table.candidates(cellOf(rgb))) {
    const p = SHADER_PALETTE[i] as readonly [number, number, number]
    const e = (p[0] - (rgb[0] + off)) ** 2 + (p[1] - (rgb[1] + off)) ** 2 + (p[2] - (rgb[2] + off)) ** 2
    if (e < best) {
      best = e
      pick = i
    }
    const x = (p[0] - rgb[0]) ** 2 + (p[1] - rgb[1]) ** 2 + (p[2] - rgb[2]) ** 2
    if (x < exact) {
      exact = x
      same = i
    }
  }
  return exact < EXACT ? same : pick
}

const SQUARES: readonly number[] = SHADER_PALETTE.map((p) => p[0] * p[0] + p[1] * p[1] + p[2] * p[2])

/** The palette colours that can be nearest to some point of the cell box `lo`..`hi` swept by `tMin`..`tMax` on all channels. */
function candidatesOf(lo: readonly number[], hi: readonly number[], tMin: number, tMax: number): number[] {
  // The colour nearest the middle of the swept cell is the first dominator; it prunes most of the palette at one test each.
  const mid = [0, 1, 2].map((k) => ((lo[k] as number) + (hi[k] as number)) / 2 + (tMin + tMax) / 2)
  let near = 0
  let nearD = Number.POSITIVE_INFINITY
  for (let i = 0; i < SHADER_PALETTE.length; i++) {
    const p = SHADER_PALETTE[i] as readonly [number, number, number]
    const d =
      (p[0] - (mid[0] as number)) ** 2 + (p[1] - (mid[1] as number)) ** 2 + (p[2] - (mid[2] as number)) ** 2
    if (d < nearD) {
      nearD = d
      near = i
    }
  }
  /** True when `j` is nearer than `i` to every point of the swept cell by more than `SLACK`: `i` can never be the pick. */
  const dominated = (i: number, j: number): boolean => {
    const a = SHADER_PALETTE[i] as readonly [number, number, number]
    const b = SHADER_PALETTE[j] as readonly [number, number, number]
    // |x − b|² − |x − a|² = (|b|² − |a|²) − 2 x·(b − a), largest where x·(b − a) is smallest: each channel at the edge its
    // weight points away from, and the sweep at the end its summed weight points away from.
    const w0 = b[0] - a[0]
    const w1 = b[1] - a[1]
    const w2 = b[2] - a[2]
    const w = w0 + w1 + w2
    const least =
      w0 * (w0 > 0 ? (lo[0] as number) : (hi[0] as number)) +
      w1 * (w1 > 0 ? (lo[1] as number) : (hi[1] as number)) +
      w2 * (w2 > 0 ? (lo[2] as number) : (hi[2] as number)) +
      w * (w > 0 ? tMin : tMax)
    return (SQUARES[j] as number) - (SQUARES[i] as number) - 2 * least < -SLACK
  }
  const first: number[] = []
  for (let i = 0; i < SHADER_PALETTE.length; i++) if (i === near || !dominated(i, near)) first.push(i)
  const kept: number[] = []
  for (const i of first) if (!first.some((j) => j !== i && dominated(i, j))) kept.push(i)
  return kept
}

const built = new Map<number, CandidateTable>()

/** The table for dither strength `strength` (0 to 1); built once for each strength and shared. */
export function candidateTable(strength: number): CandidateTable {
  const cached = built.get(strength)
  if (cached) return cached
  // The offset spans from the Bayer matrix's first value to its last (0 and 15 sixteenths, less a half).
  const tMin = -0.5 * strength
  const tMax = (15 / 16 - 0.5) * strength
  const lists: number[][] = []
  let maxCount = 1
  for (let b = 0; b < GRID; b++)
    for (let g = 0; g < GRID; g++)
      for (let r = 0; r < GRID; r++) {
        const lo = [r / GRID - MARGIN, g / GRID - MARGIN, b / GRID - MARGIN]
        const hi = [(r + 1) / GRID + MARGIN, (g + 1) / GRID + MARGIN, (b + 1) / GRID + MARGIN]
        const list = candidatesOf(lo, hi, tMin, tMax)
        maxCount = Math.max(maxCount, list.length)
        lists.push(list)
      }
  const groups = Math.ceil((1 + maxCount) / 4)
  const width = GRID * GRID
  const height = GRID * groups
  const data = new Uint8Array(width * height * 4)
  lists.forEach((list, cell) => {
    const x = cell % (GRID * GRID)
    const b = Math.floor(cell / (GRID * GRID))
    // Slot 0 is the count less one (a cell always has one), so a palette of 256 colours still fits a byte.
    const slots = [list.length - 1, ...list]
    slots.forEach((value, slot) => {
      const y = b * groups + (slot >> 2)
      data[(y * width + x) * 4 + (slot & 3)] = value
    })
  })
  const table: CandidateTable = {
    strength,
    maxCount,
    groups,
    width,
    height,
    data,
    candidates: (cell) => lists[cell] as number[],
  }
  built.set(strength, table)
  return table
}

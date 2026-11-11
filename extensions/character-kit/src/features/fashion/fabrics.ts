// The runway's seven fabrics, as the builder's fabric tiles (H5, `registerFabric`): a pattern a swatch names (`fabric:
// 'twill22'`) and the painter lays over the cloth's own tone steps. Data only. Ported from FigureBuilder's showcase
// `claude/runway-video` (`demo/runway/wardrobe.ts`, `cb4aa9f`).
import type { Fabric } from '../../shared/figure-builder/door.ts'

const grid = (w: number, h: number, label: (column: number, row: number) => number) =>
  Array.from({ length: w * h }, (_, i) => label(i % w, Math.floor(i / w)))

/** One label per texel at D2 (73.8 texels a metre), so a pattern keeps its size at D1 and D4. */
const D2 = 1 / 73.8

export const FABRICS: Readonly<Record<string, Fabric>> = {
  // Denim: a 2/2 twill, a two-texel diagonal hatch one step dark (a motif).
  twill22: { w: 4, h: 4, labels: grid(4, 4, (c, r) => ((((c + r) % 4) + 4) % 4 < 2 ? -1 : 0)) },
  // Rib knit: alternate columns round the body (a motif).
  rib: { w: 2, h: 1, labels: [0, -1] },
  // Gingham: light squares, dark squares and the mid between, 4 texels a square at D2.
  gingham: {
    w: 8,
    h: 8,
    labels: grid(8, 8, (c, r) => (c < 4 === r < 4 ? (c < 4 ? 1 : -2) : -1)),
    metres: D2,
  },
  // A tonal Breton stripe across the body: three light rows, three dark.
  breton: { w: 1, h: 6, labels: [1, 1, 1, -2, -2, -2], metres: D2 },
  // Pinstripe: one light column in six, the ground a step under the swatch's base.
  pinstripe: { w: 6, h: 1, labels: [1, -1, -1, -1, -1, -1], metres: D2 },
  // A tartan-ish plaid: a wide dark band and a light hairline each way, 12 texels a repeat.
  plaid: {
    w: 12,
    h: 12,
    labels: grid(12, 12, (c, r) => {
      const band = (i: number) => (i < 4 ? -1 : 0)
      const line = (i: number) => (i === 8 ? 1 : 0)
      return Math.max(-2, Math.min(1, line(c) || line(r) ? 1 : band(c) + band(r)))
    }),
    metres: D2,
  },
  // A windowpane check: one-texel hairlines every 12 texels, a step dark.
  windowpane: { w: 12, h: 12, labels: grid(12, 12, (c, r) => (c === 0 || r === 0 ? -1 : 0)), metres: D2 },
}

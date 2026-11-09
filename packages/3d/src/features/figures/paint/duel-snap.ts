import { atan2, cos, hypot, sin } from '@automata/sim/math'
import { oklab } from '../../../shared/math/colour.ts'
import { DUEL, duel, duelLab, RAMPS } from '../../../shared/math/duel.ts'
import type { PainterMaterial } from '../figure/materials.ts'
import { must } from './vec.ts'
/** The outline colour (row 6, step 0): never shaded. */
export const RAMP_OUTLINE = 0x002219
/** The outline's colour: DUEL black. */
export const INK = '#000000'
export { DUEL, duel, duelLab, RAMPS }
export const hex = (h: string): number => parseInt(h.slice(1), 16)
/** Two ramps mixed tone by tone, `at` of the way from `from` to `to`: lightness and chroma in OKLab, the hue `to`'s, so
 * a fade's tiers run from the hair's dark into the wearer's own skin (never through a grey or a violet between them, as
 * a mix of the colours would), DUEL-snapped. */
function mixTones(from: number[], to: number[], at: number) {
  return from.map((c, i) => {
    const a = oklab(c),
      b = oklab(to[Math.min(i, to.length - 1)] ?? Number.NaN),
      hue = atan2(b[2], b[1])
    const L = a[0] + (b[0] - a[0]) * at,
      C = hypot(a[1], a[2]) + (hypot(b[1], b[2]) - hypot(a[1], a[2])) * at
    return duelLab(L, C * cos(hue), C * sin(hue))
  })
}
/** A material's four painted tones, DUEL-snapped; a blend (`mix`) mixed. */
export function tonesOf(m: PainterMaterial): number[] {
  if (m.mix) return mixTones(m.mix.from.map(hex), m.mix.to.map(hex), m.mix.at)
  if (m.paint) return m.paint.map((h) => duel(hex(h)))
  const row = must(RAMPS, m.ramp),
    at = (o: number) => row[Math.max(0, Math.min(7, m.base + o))] ?? Number.NaN
  return [at(1), at(0), at(-1), at(-2)]
}
export const INK_RGB: number = duel(hex(INK))

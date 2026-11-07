// A shell on the head between two lines round it: a scalp's hair, a fade's tiers, a cap's crown. Lifted off
// the head's form, fuller toward the crown, ridged the way the hair is combed, with a sheen of lit streaks
// along the comb split into a second mesh (drawn a tone up).
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/hair.ts at a1f7246 (`shell`,
// `combPhase`), with AF's strict types; the formulas and their order are the source's.

import { clamp, cross, dot, hash, lerp, normalize, smooth, sub, type V3 } from '../../../shared/math/math.ts'
import type { Mesh } from '../body/mesh.ts'
import type { Line, Vec2, Vec3 } from '../content/shapes.schema.ts'
import type { HeadForm } from '../outfit/garments/head.ts'
import { along, onHead, onSkull, type Skull } from './skull.ts'
import { grid, spindle } from './sweep.ts'

/** The options of a shell: the head's lines it runs between, how far it lifts, how it is combed and cut. A cap's dome
 * is one; so is a scalp piece of the character kit. */
export interface Scalp {
  readonly from: Line
  readonly to?: Line | undefined
  readonly lift: number
  readonly crown?: number | undefined
  readonly edge?: number | undefined
  readonly ridges?: Vec2 | undefined
  readonly comb?: Vec3 | 'back' | undefined
  readonly tone?: string | undefined
  readonly cut?: { readonly at: number; readonly width: number; readonly height: number } | undefined
  readonly sheen?:
    | {
        readonly count: number
        readonly from: number
        readonly to: number
        readonly width?: number | undefined
        readonly ragged?: number | undefined
        readonly at?: number | undefined
      }
    | undefined
  readonly grade?: readonly (readonly [number, string])[] | undefined
  readonly span?: number | undefined
}

/**
 * The angle round the way the hair is combed: round the axis it is combed toward, or across the head (combed
 * back).
 */
function combPhase(k: Skull, comb: V3 | 'back', a: number, y: number): number {
  const p = sub(onSkull(k, a, y), k.c)
  const d: V3 = [p[0] / k.r[0], p[1] / k.r[1], p[2] / k.r[2]]
  if (comb === 'back') return Math.asin(clamp(d[0] / (Math.hypot(...d) || 1), -1, 1))
  const ax = normalize(comb)
  const u = normalize(cross(ax, Math.abs(ax[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]))
  const w = cross(ax, u)
  return Math.atan2(dot(d, w), dot(d, u))
}

/** A shell between two lines round the head (`to` the crown when left out), `lift` of the skull's half-width
 * off its form `f` along its normal, with a hole `cut` in it (a cap's gap). `keep` picks its cells by row (a
 * fade's tiers). */
export function shell(
  k: Skull,
  o: Scalp,
  f: HeadForm,
  keep?: (i: number) => boolean,
): { mesh: Mesh; lit: Mesh | undefined } {
  const cols = 56
  const rows = 18
  const comb: V3 | 'back' = o.comb ?? [0, 1, 0]
  const lift = (t: number, a: number, y: number) => {
    const ridged = o.ridges
      ? 1 + o.ridges[1] * Math.cos(o.ridges[0] * combPhase(k, comb, a, y)) * smooth(t * 3)
      : 1
    // Thinner at the hairline (`edge`, of the lift), fuller toward the crown.
    return (o.lift * lerp(o.edge ?? 1, 1, smooth(t * 4)) + (o.crown ?? 0) * Math.max(0, y)) * ridged
  }
  const point = (i: number, j: number) => {
    const a = -Math.PI + (2 * Math.PI * j) / cols
    const y0 = along(o.from, a)
    const y1 = o.to ? along(o.to, a) : 1
    const t = i / rows
    const y = lerp(y0, y1, t)
    return onHead(f, k, a, y, lift(t, a, y))
  }
  const mid = (i: number, j: number) => {
    const a = -Math.PI + (2 * Math.PI * (j + 0.5)) / cols
    const y0 = along(o.from, a)
    return { a, y0, y: lerp(y0, o.to ? along(o.to, a) : 1, (i + 0.5) / rows) }
  }
  const cut = (i: number, j: number) => {
    if (keep && !keep(i)) return true
    if (o.span !== undefined && Math.abs(mid(i, j).a) > o.span) return true
    if (!o.cut) return false
    const { a, y0, y } = mid(i, j)
    const d =
      Math.abs(((((a - o.cut.at + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI) /
      o.cut.width
    const up = (y - y0) / o.cut.height
    return d * d + up * up < 1
  }
  const sheen = o.sheen
  const streak = (i: number, j: number) => {
    if (!sheen) return false
    const { a, y } = mid(i, j)
    const q = (sheen.count * (combPhase(k, comb, a, y) - (sheen.at ?? 0))) / (2 * Math.PI)
    const n = Math.round(q)
    const r = (sheen.ragged ?? 0.12) * (hash(n * 13 + 5) - 0.5) * 2
    const lo = sheen.from + r
    const hi = sheen.to + r * 0.5
    return Math.abs(q - n) < (sheen.width ?? 0.22) * spindle((y - lo) / (hi - lo))
  }
  const mesh = grid(
    rows,
    cols,
    point,
    true,
    () => k.c,
    (i, j) => cut(i, j) || streak(i, j),
  )
  return {
    mesh,
    lit: sheen
      ? grid(
          rows,
          cols,
          point,
          true,
          () => k.c,
          (i, j) => cut(i, j) || !streak(i, j),
        )
      : undefined,
  }
}

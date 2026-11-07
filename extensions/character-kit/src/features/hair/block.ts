// A block: a high-top's block of tight coils. The head's own section at its foot, so its walls rise out of the faded sides
// with no hem; straight up, flaring a little, over a rounded edge to a flat top in the crest tone. Its cells are a texel
// each at the fixed ppm, a share of the sides' hash-picked into the lit tone: the coils' dither.
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/hair.ts at a1f7246 (`block`), with AF's strict
// types; the formulas and their order are the source's.

import {
  at,
  clamp,
  FIGURE_PPM,
  grid,
  HAIR_SEAM,
  type HairBuild,
  hash,
  headAt,
  lerp,
  smooth,
  sub,
  toneSchema,
  type V3,
} from '@automata/3d/figures-kit'
import { z } from 'zod'
import type { KitPiece } from './kit-piece.ts'

export interface Block {
  readonly from: number
  readonly to: number
  readonly flare?: number | undefined
  readonly lift?: number | undefined
  readonly round?: number | undefined
  readonly coil?: number | undefined
  readonly tone?: string | undefined
  readonly top?: string | undefined
}

const n = z.number()

const schema: z.ZodType<Block> = z.strictObject({
  from: n,
  to: n,
  flare: n.optional(),
  lift: n.optional(),
  round: n.optional(),
  coil: n.optional(),
  tone: toneSchema.optional(),
  top: toneSchema.optional(),
})

function build(b: HairBuild, o: Block): void {
  const { k, form, hw } = b
  const t0 = (o.from + 1) / 2
  const y0 = t0 * form.h
  const y1 = k.c[1] + o.to * k.r[1]
  const c0: V3 = [0, y0, (form.front(t0) + form.back(t0)) / 2]
  const flare = o.flare ?? 1
  const lift = (o.lift ?? 0) * hw
  const rho = (o.round ?? 0.15) * hw
  const coil = o.coil ?? 0.4
  const foot = (v: number) => sub(headAt(form, t0, v), c0)
  const ring = Array.from({ length: 48 }, (_, j) => foot((2 * Math.PI * j) / 48))
  const around =
    (ring.reduce((l, d, j) => l + Math.hypot(...sub(d, at(ring, (j + 1) % 48))), 0) * (1 + flare)) / 2
  const cols = Math.max(24, Math.ceil(around * FIGURE_PPM))
  const walls = Math.max(6, Math.ceil((y1 - rho - y0) * FIGURE_PPM))
  const edge = 3
  const cap = 3
  const rows = walls + edge + cap
  const R = (r0: number, y: number) => {
    const q = clamp((y - y0) / (y1 - y0), 0, 1)
    return r0 * lerp(1, flare, q) + lift * smooth(q * 4)
  }
  const point = (i: number, j: number): V3 => {
    const d = foot((2 * Math.PI * j) / cols)
    const r0 = Math.hypot(d[0], d[2]) || 1e-6
    let r: number
    let y: number
    if (i <= walls) {
      y = lerp(y0, y1 - rho, i / walls)
      r = R(r0, y)
    } else if (i <= walls + edge) {
      const ph = (((i - walls) / edge) * Math.PI) / 2
      y = y1 - rho + rho * Math.sin(ph)
      r = R(r0, y1) - rho * (1 - Math.cos(ph))
    } else {
      y = y1
      r = (R(r0, y1) - rho) * (1 - (i - walls - edge) / cap)
    }
    return [c0[0] + (d[0] / r0) * r, y, c0[2] + (d[2] / r0) * r]
  }
  // The crest takes the top and the edge's upper part, so it shows a band two or three texels deep even seen level.
  const inner = (): V3 => [c0[0], (y0 + y1) / 2, c0[2]]
  const top = (i: number) => i > walls
  const coiled = (i: number, j: number) => !top(i) && hash(i * 92821 + j * 68917) < coil
  b.rigid(
    grid(rows, cols, point, true, inner, (i, j) => top(i) || coiled(i, j)),
    o.tone ?? 'hair',
    HAIR_SEAM,
    grid(rows, cols, point, true, inner, (i, j) => !coiled(i, j)),
    true,
  )
  b.rigid(
    grid(rows, cols, point, true, inner, (i) => !top(i)),
    o.top ?? 'crest',
    HAIR_SEAM,
  )
}

export const BLOCK: KitPiece = { kind: 'block', piece: { schema, build, crown: true } }

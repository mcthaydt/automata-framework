// Strands: locks of rope hung from the skull. Each goes down the head to where it hangs plumb, then straight down, its
// angle swinging to `to` on the way (so a lock swept toward the face crosses the cheek), flicking out at the tip. A lock
// that stands off the middle of the head is mirrored to the other side. `bare` locks are for a bare head, `capped` ones for
// a hair under a cap.
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/hair.ts at a1f7246 (`hairParts`'s `fall` as a
// list of locks), with AF's strict types; the formulas and their order are the source's. A style that wrote these as a
// `fall` writes `strands`: `fall` is loose hair.

import {
  add,
  HAIR_SEAM,
  type HairBuild,
  J,
  lerp,
  normalize,
  onHead,
  type Rope,
  ropeSchema,
  scale,
  smooth,
  sub,
  sweep,
  toneSchema,
  type V3,
} from '@automata/3d/figures-kit'
import { z } from 'zod'
import type { KitPiece } from './kit-piece.ts'

export interface Strands {
  /** Each lock: [angle round the head, root height, tip height, its own lift?, tip angle?]. */
  readonly at: readonly (readonly number[])[]
  readonly lift: number
  readonly plumb: number
  readonly out?: number | undefined
  readonly flick?: number | undefined
  readonly rope: Rope
  readonly apart?: boolean | undefined
  readonly tone?: string | undefined
  readonly seam?: number | undefined
  readonly matte?: boolean | undefined
  readonly bare?: boolean | undefined
  readonly capped?: boolean | undefined
}

const n = z.number()

const schema: z.ZodType<Strands> = z.strictObject({
  at: z.array(z.array(n).min(3).max(5)).min(1),
  lift: n,
  plumb: n,
  out: n.optional(),
  flick: n.optional(),
  rope: ropeSchema,
  apart: z.boolean().optional(),
  tone: toneSchema.optional(),
  seam: n.optional(),
  matte: z.boolean().optional(),
  bare: z.boolean().optional(),
  capped: z.boolean().optional(),
})

function build(b: HairBuild, o: Strands): void {
  const { input: i, k, form, hw } = b
  if ((o.bare && i.capped) || (o.capped && !i.capped)) return
  const locks = o.at.flatMap((knot) => {
    const [a = 0, y0 = 0, y1 = 0, own, to] = knot
    const lock = [a, y0, y1, own ?? o.lift, to ?? a]
    return a > 1e-3 && a < Math.PI - 1e-3 ? [lock, lock.map((v, q) => (q === 0 || q === 4 ? -v : v))] : [lock]
  })
  for (const [a = 0, y0 = 0, y1 = 0, lift = 0, to = 0] of locks) {
    // Down the skull to where it hangs plumb, then straight down, its angle swinging to `to` on the way.
    const top = onHead(form, k, a, y0, o.lift)
    const path: V3[] = [top]
    const steps = 10
    const outDir = (aq: number) => {
      const p = onHead(form, k, aq, Math.min(y0, o.plumb), lift)
      return normalize([p[0] - k.c[0], 0, p[2] - k.c[2]])
    }
    for (let q = 1; q <= steps; q++) {
      const y = lerp(y0, y1, q / steps)
      const aq = lerp(a, to, smooth(q / steps))
      const off = lerp(o.lift, lift, smooth((q / steps) * 5))
      const plumb = onHead(form, k, aq, Math.min(y0, o.plumb), off)
      const p: V3 = y > o.plumb ? onHead(form, k, aq, y, off) : [plumb[0], k.c[1] + y * k.r[1], plumb[2]]
      const below = Math.max(0, o.plumb - y) / Math.max(1e-6, o.plumb - y1)
      path.push(add(p, scale(outDir(aq), hw * ((o.out ?? 0) * below + (o.flick ?? 0) * below ** 3))))
    }
    const { mesh, lit, t } = sweep(path, o.rope, hw, (p, tt) =>
      tt < 0.15 ? sub(p, k.c) : add(outDir(lerp(a, to, tt)), [0, 0.3, 0]),
    )
    const joint = Math.abs(a) > Math.PI * 0.7 ? J['hair.back'] : a > 0 ? J['hair.L'] : J['hair.R']
    b.hung(
      mesh,
      t,
      o.tone ?? 'hair',
      (tt) => {
        const w = smooth((tt - 0.1) / 0.9) * 0.9
        return [
          [J.head, 1 - w],
          [joint, w],
        ]
      },
      o.apart ? b.nextSeam() : (o.seam ?? HAIR_SEAM),
      lit,
      o.matte,
    )
  }
}

export const STRANDS: KitPiece = { kind: 'strands', piece: { schema, build } }

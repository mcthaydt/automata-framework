// An apron: its skirt just outside the dress's (and any coat's), a bib, straps over the shoulders or round the neck, a
// tie at the back, pockets in its own cloth.
//
// Ported from the figure code this kit grew out of (`dress`'s apron
// branch), with AF's strict types; the formulas are the source's.

import type { Garment } from '@automata/3d/figures'
import {
  axisAngle,
  box,
  type Dressing,
  GROUP,
  hemAt,
  J,
  SIDES,
  TRAPEZIUS,
  trapezius,
} from '@automata/3d/figures-kit'
import { z } from 'zod'
import { hang } from './hang.ts'
import { flag, type KitGarment, length, optionalSwatch, swatch, within } from './kit-garment.ts'
import type { Skirt } from './skirt.ts'

export interface Apron {
  readonly apron: string
  readonly shade?: string | undefined
  readonly length: number
  readonly bib?: boolean | undefined
  readonly straps?: 'cross' | 'neck' | undefined
  readonly pockets?: boolean | undefined
  /** The bib's half-width (of the shoulders), how far the skirt wraps round (rad either side of the front). */
  readonly bibWidth?: number | undefined
  readonly wrap?: number | undefined
  /** A tie knotted at the back. */
  readonly tie?: boolean | undefined
}

/** The front of the body, as an angle round the tube's axis. */
const FRONT = Math.PI / 2

function wear(d: Dressing, garment: Garment): void {
  const item = garment as Apron
  const { m, s, parts } = d
  const g = s.genes
  const k = m.k
  const t = m.thick
  const waistY = s.hipY + 0.14 * k
  const chestFront = 0.1 * k * t * m.depth
  const bottom = hemAt(s, item.length)
  // The apron's skirt sits just outside the dress's: cinched at the waist, flaring as the dress does.
  const dress = d.garments.find((x): x is Skirt => 'skirt' in x)
  const flare = (0.16 + 0.1 * (dress?.flare ?? 0.4)) * k
  const wrap = item.wrap ?? (item.straps === 'neck' ? 1.45 : 1.1)
  parts.push(
    hang(item.apron, GROUP.skirt, waistY - 0.01, bottom, {
      waist: Math.max(0.15 * k * m.waist, d.outer.waist * 1.06),
      hem: Math.max(flare * 0.95, d.outer.hem * 1.04),
      depth: (item.wrap ?? 0) > 1.6 ? 1 : 0.84,
      follow: 0.75,
      arc: [FRONT - wrap, FRONT + wrap],
      seg: 12,
    }),
  )
  if (item.bib !== false) {
    parts.push(
      box(J.chest, item.apron, GROUP.torso, {
        at: [0, 0.035 * k, d.front * 0.93],
        r: [g.shoulders * (item.bibWidth ?? (item.straps === 'neck' ? 0.7 : 0.56)), 0.115 * k, 0.022 * k],
        e: [0.35, 0.45],
        taper: [0.92, 1],
      }),
    )
    d.front = d.front * 0.93 + 0.024 * k
  }
  if (item.straps === 'cross') {
    // Over each shoulder, lying on the trapezius's slope, front to back.
    parts.push(
      ...SIDES.map(([, x]) =>
        box(J.chest, item.apron, GROUP.torso, {
          at: trapezius(s, x, g.shoulders * 0.04, 0.03 * k),
          r: [0.026 * k, 0.014 * k, chestFront * 1.08],
          turn: axisAngle([0, 0, 1], -x * TRAPEZIUS),
          e: [0.35, 0.45],
        }),
      ),
    )
    parts.push(
      ...SIDES.map(([, x]) =>
        box(J.chest, item.apron, GROUP.torso, {
          at: [0, -0.02 * k, -chestFront * 0.98],
          r: [0.022 * k, 0.16 * k, 0.012 * k],
          turn: axisAngle([0, 0, 1], x * 0.45),
          e: [0.35, 0.45],
        }),
      ),
    )
  }
  // The tie: a knot at the small of the back and its two ends hanging from it.
  if (item.tie) {
    const back = -Math.max(0.105 * k * t * m.depth, d.outer.waist) - 0.012 * k
    const knotY = waistY - s.hipY - 0.05 * k - 0.01
    parts.push(
      box(J.pelvis, item.apron, GROUP.torso, {
        at: [0, knotY, back],
        r: [0.028 * k, 0.02 * k, 0.014 * k],
        e: [0.5, 0.5],
      }),
    )
    parts.push(
      ...SIDES.map(([, x]) =>
        box(J.pelvis, item.apron, GROUP.torso, {
          at: [x * 0.018 * k, knotY - 0.07 * k, back + 0.004 * k],
          r: [0.012 * k, 0.065 * k, 0.008 * k],
          turn: axisAngle([0, 0, 1], x * 0.12),
          e: [0.35, 0.45],
        }),
      ),
    )
  }
  if (item.straps === 'neck')
    parts.push(
      box(J.neck, item.apron, GROUP.torso, {
        at: [0, 0, 0],
        r: [0.05 * k, 0.012 * k, 0.05 * k],
        e: [0.3, 0.3],
      }),
    )
  // Pockets in the apron's own cloth.
  if (item.pockets)
    parts.push(
      ...SIDES.map(([, x]) =>
        box(J.pelvis, item.apron, GROUP.torso, {
          at: [x * 0.075 * k, -0.11 * k, 0.17 * k],
          r: [0.05 * k, 0.045 * k, 0.012 * k],
          e: [0.3, 0.4],
        }),
      ),
    )
}

export const APRON: KitGarment = {
  name: 'apron',
  kind: {
    schema: z.strictObject({
      apron: swatch,
      shade: optionalSwatch,
      length,
      bib: flag,
      straps: z.enum(['cross', 'neck']).optional(),
      pockets: flag,
      // Of the shoulders' half-width; rad either side of the front.
      bibWidth: within(0.1, 1.2).optional(),
      wrap: within(0.2, Math.PI).optional(),
      tie: flag,
    }),
    swatches: {},
    wear,
  },
}

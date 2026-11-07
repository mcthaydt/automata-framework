// A fall: loose hair. Each clump (a rope) goes from the crown over the scalp to its hairline, past the ear and the jaw
// (always outside the head's form, `volume` standing it further off), then straight down, drifting behind the dressed
// trunk by the shoulders and clear of it (as the tail's `trunkBack` takes it) to the length; a wave or a spiral about that
// path by `curl`. Curls are fatter and shorter than straight hair. (The older lists of hanging locks are `strands`.)
//
// Ported from FigureBuilder (mcthaydt/FigureBuilder) src/features/hair/hair.ts at 025ffb4 (`hairParts`'s `fall`), with
// AF's strict types; the formulas and their order are the source's. Changed: a texel is the fixed ppm's.

import {
  add,
  along,
  clamp,
  FIGURE_PPM,
  type HairBuild,
  hash,
  J,
  type Line,
  lerp,
  line,
  normalize,
  onHead,
  type Rope,
  reach,
  ropeSchema,
  scale,
  smooth,
  spline,
  sweep,
  type V3,
  type Weight,
} from '@automata/3d/figures-kit'
import { z } from 'zod'
import type { KitPiece } from './kit-piece.ts'

/**
 * Loose hair: `count` clumps (ropes) laid on the scalp round the head from the hairline `from` and falling past it, either
 * side of the parting `part` (an angle from the front, 0 the centre), over the ears, past the collar and behind the
 * shoulders, to `length` (0 the jaw to 1 the shoulder blades; clamped there), clear of the dressed trunk. `curl` 0 to 1:
 * straight, rising to waves, then spirals, the clumps fatter and shorter as it rises; `volume` 0 to 1: how far the mass
 * stands off the skull, so curl 1 and volume 1 at a short length is a round afro.
 */
export interface Fall {
  readonly from: Line
  readonly part?: number | undefined
  readonly count: number
  readonly length: number
  readonly curl?: number | undefined
  readonly volume?: number | undefined
  readonly rope: Rope
}

const n = z.number()

const schema: z.ZodType<Fall> = z.strictObject({
  from: line,
  part: n.optional(),
  count: z.number().int().positive(),
  length: n,
  curl: n.optional(),
  volume: n.optional(),
  rope: ropeSchema,
})

function build(b: HairBuild, o: Fall): void {
  const { input: i, k, form, head, hw } = b
  const { s, m } = i
  const curl = clamp(o.curl ?? 0, 0, 1)
  const volume = clamp(o.volume ?? 0, 0, 1)
  const kk = m.k
  const texel = 1 / FIGURE_PPM
  const rope: Rope = { ...o.rope, r: o.rope.r * (1 + 0.5 * curl), root: 0.02 }
  const ra = rope.r * hw
  const clear = ra * 1.2 + texel
  const chin = s.chinY - head[1]
  const shoulder = s.shoulderY - head[1]
  const chest = s.chestY - head[1]
  const yEnd = lerp(chin, chest, clamp(o.length, 0, 1) * (1 - 0.35 * curl))
  const trunkBack = (y: number) => {
    const r = reach(i.trunk ?? [], s.rest, [0, y + head[1], 0], [0, 0, -1])
    return r > 0 ? -r - head[2] - clear : Number.POSITIVE_INFINITY
  }
  // Out of the head's form by the rope's own radius (and a little over), and further by the volume.
  const lift = rope.r * 1.6 + 0.55 * volume
  const gap = 0.35
  const part = o.part ?? 0
  for (let j = 0; j < o.count; j++) {
    const a0 = part + gap + ((2 * Math.PI - 2 * gap) * (j + 0.5 + 0.2 * (hash(j * 3 + 1) - 0.5))) / o.count
    const a = ((((a0 + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI
    const y0 = along(o.from, a)
    const yb = Math.max(-0.7, y0 + 0.1)
    const sideRide = Math.abs(Math.sin(a)) > 0.55
    // Down the scalp to the hairline, then down the head to the jaw: a clump that starts in front of the ear sweeps
    // round behind it (past 2.4 rad from the front), so it never lies across the face and reaches the back of the
    // neck, not the sides.
    const aEar = Math.sign(a) * Math.max(Math.abs(a), 2.4)
    const path: V3[] = []
    // From the crown itself (every clump's root meets there, lifted by the volume), so the mass closes over the top.
    for (let q = 0; q <= 4; q++) path.push(onHead(form, k, a, lerp(0.97, yb, q / 4), lift + (0.03 * q) / 4))
    for (let q = 1; q <= 5; q++)
      path.push(
        onHead(
          form,
          k,
          lerp(a, aEar, smooth(Math.min(1, q / 2.5))),
          lerp(yb, -0.76, q / 5),
          lift + 0.03 + (0.02 * q) / 5,
        ),
      )
    const jaw = path[path.length - 1] ?? ([0, 0, 0] as V3)
    // Below the jaw: straight down, behind the trunk from the shoulders on (and by the shoulders already, drifting back).
    const yJ = jaw[1]
    const zBack = Math.min(jaw[2], trunkBack(Math.max(shoulder + 0.03 * kk, yEnd)))
    const steps = yEnd < yJ - 1e-4 ? Math.max(2, Math.ceil((yJ - yEnd) / (0.05 * kk))) : 0
    for (let q = 1; q <= steps; q++) {
      const y = lerp(yJ, yEnd, q / steps)
      const w = smooth((yJ - y) / Math.max(1e-6, yJ - shoulder))
      // It follows the back and the tops of the shoulders: narrowing toward the spine as it falls, never out.
      path.push([jaw[0] * (1 - 0.3 * w), y, Math.min(lerp(jaw[2], zBack, w), trunkBack(y))])
    }
    let line = spline(path, 40)
    if (curl > 0 && steps) {
      // A wave (curl under a half) or a spiral (from a half): about the path below the jaw, out and across it, fading in.
      const radial = normalize([jaw[0], 0, jaw[2] - k.c[2]])
      const tangent: V3 = [-radial[2], 0, radial[0]]
      const amp = ra * (0.4 + 1.2 * curl)
      const cycles = 1.5 + 4 * curl
      const phase = hash(j * 5 + 2) * 2 * Math.PI
      const last = line.length - 1
      line = line.map((p, n) => {
        const q = n / last
        const fade =
          smooth((yJ - p[1]) / Math.max(1e-6, (yJ - yEnd) * 0.25)) *
          (p[1] < yJ ? 1 : 0) *
          (1 - 0.7 * smooth((q - 0.8) / 0.2))
        if (!fade) return p
        const th = 2 * Math.PI * cycles * q + phase
        const out = curl < 0.5 ? Math.sin(th) : Math.cos(th)
        const across = curl < 0.5 ? 0 : Math.sin(th)
        const moved = add(p, add(scale(radial, out * amp * fade), scale(tangent, across * amp * fade)))
        return [moved[0], moved[1], Math.min(moved[2], trunkBack(moved[1]))] as V3
      })
    }
    const { mesh, lit, t } = sweep(line, rope, hw, (p) => normalize([p[0], 0, p[2] - k.c[2]]))
    const bone = sideRide ? (Math.sin(a) > 0 ? J['hair.L'] : J['hair.R']) : J['hair.back']
    // The top rides the head, the length swings from its pivot and settles toward the neck as it falls.
    const swing = 0.5
    const swingOf = (tt: number): Weight[] => {
      const w = smooth((tt - 0.08) / 0.4)
      const lay = smooth((tt - 0.45) / 0.55) * (1 - swing)
      return [
        [J.head, 1 - w],
        [bone, w * (1 - lay)],
        [J.neck, w * lay],
      ]
    }
    b.hung(mesh, t, 'hair', swingOf, b.nextSeam(), lit, curl >= 0.5 ? true : undefined)
  }
}

export const FALL: KitPiece = { kind: 'fall', piece: { schema, build } }

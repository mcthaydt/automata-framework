// A ponytail: a high one tied on the crown, its ropes gathered in a ring at the tie, rising out of it, arcing back
// over the top and falling onto the back of the head still gathered, then down the back, fanning a little,
// clear of the dressed trunk by a rope and a texel. Every other rope is thinner and in the hair's deep, sunk
// between its neighbours: the partings. Their plaits run on a slant, turned against their neighbours' and
// half a bead apart, so the tail reads as ropes running down in a herringbone. A low pony (`hang`) is tied at the nape
// and falls straight down the back, with no rise and no arc over the crown.
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/hair.ts at a1f7246 (`hairParts`'s
// `tail`, with its `hang`), with AF's strict types; the formulas and their order are the source's. Changed: a texel is the
// fixed ppm's, and the cuffs, which the source builds only from 1.5 × its ppm (a sprite's legibility floor),
// are always built (M3.5b decision 4).

import {
  add,
  clamp,
  cross,
  hash,
  lerp,
  normalize,
  scale,
  smooth,
  sub,
  type V3,
} from '../../../shared/math/math.ts'
import { superquadric } from '../../../shared/math/superquadric.ts'
import type { Weight } from '../body/mesh.ts'
import { reach } from '../body/reach.ts'
import { at, J } from '../body/rig.ts'
import { FIGURE_PPM, texels } from '../body/texels.ts'
import type { Rope, Tail } from '../content/hair.schema.ts'
import type { HairBuild } from './hair-parts.ts'
import { alignY, toHead } from './skull.ts'
import { spline, sweep } from './sweep.ts'

export function tail(b: HairBuild, o: Tail): void {
  const { input: i, k, form, head, hw, parts } = b
  const { s, m } = i
  const base = toHead(form, k, o.at, 0.05)
  const g = s.genes
  const kk = m.k
  // A low pony's ropes gather in a ring across the fall (horizontal), its axis straight up; a high one's axis is out of
  // the crown.
  const up: V3 = o.hang ? [0, 1, 0] : normalize(sub(base, k.c))
  const side: V3 = o.hang ? [1, 0, 0] : normalize(cross(up, [0, 0, 1]))
  const fore: V3 = o.hang ? [0, 0, 1] : cross(side, up)
  const texel = 1 / FIGURE_PPM
  const ar = o.rope.r * hw
  const shoulder = s.shoulderY - head[1]
  const end = shoulder - o.length * g.head
  const rise = o.rise * g.head
  const tie = add(base, scale(up, rise * 0.45))
  const bundle = o.spread[0] * hw
  const x1 = o.spread[1] * hw
  const clear = ar * 1.2 + texel
  // The back of the head at a height (head space), and the dressed trunk's furthest back down the tail's
  // length.
  const headBack = (y: number) => form.back(clamp(y / form.h, 0.02, 0.98))
  const trunkBack = (y: number) => {
    const r = reach(i.trunk ?? [], s.rest, [0, y + head[1], 0], [0, 0, -1])
    return r > 0 ? -r - head[2] : Infinity
  }
  const hang =
    Math.min(
      headBack(k.c[1] - 0.6 * k.r[1]),
      ...[0, 0.2, 0.4, 0.6, 0.8, 1].map((q) => trunkBack(lerp(shoulder + 0.03 * kk, end, q))),
    ) - clear
  // Its fall stands off the back of the head as it comes down from the crown, and hangs from the shoulder
  // blades.
  const nape = k.c[1] - 0.55 * k.r[1]
  const off = o.off ?? 0.25
  const napeZ = Math.min(headBack(nape) - off * k.r[2], trunkBack(nape)) - clear
  for (let r = 0; r < o.count; r++) {
    const u = o.count === 1 ? 0 : (r / (o.count - 1)) * 2 - 1
    const ring = (2 * Math.PI * (r + 0.5)) / o.count
    const jit = hash(r * 7 + 3) - 0.5
    // A layer out from the back (−z) for the ropes on top, so those under lie nearer the body, between them.
    const top = r % 2 === 0
    const layer = 0
    const x = (w: number) => u * lerp(bundle, x1, w)
    const around = (p: V3, w: number) =>
      add(p, add(scale(side, Math.cos(ring) * bundle * w), scale(fore, Math.sin(ring) * bundle * w)))
    // A low pony runs from its tie straight down the back of the head to the nape: no rise, no arc.
    const down = (y: number): V3 => [
      x(0.15),
      y,
      Math.min(headBack(y) - off * 0.6 * k.r[2], base[2]) - clear - layer,
    ]
    const path: V3[] = [
      around(base, 0.8),
      around(tie, 1),
      ...(o.hang
        ? [down((base[1] + nape) / 2)]
        : [
            // Up out of the tie, over the top still gathered, and down onto the back of the head.
            add(around(tie, 1.05), add(scale(up, rise * 0.45), [0, 0, -0.25 * k.r[2]])),
            add(around(tie, 1.15), [0, rise * 0.3, -0.62 * k.r[2] - layer]),
            [
              x(0.15),
              k.c[1] + 0.5 * k.r[1],
              headBack(k.c[1] + 0.5 * k.r[1]) - off * 0.6 * k.r[2] - clear - layer,
            ] as V3,
          ]),
      [x(0.4), nape, napeZ - layer],
      [x(0.85), shoulder, Math.min(napeZ, hang) - layer],
      [x(1), end + jit * 0.1 * g.head, hang - layer - 0.01 * kk],
    ]
    // The ropes on top plait on a slant, turned against the next one's and half a bead on; those under are
    // its partings.
    const n2 = r >> 1
    const rope: Rope = top
      ? {
          ...o.rope,
          root: 0.02,
          phase: (n2 % 2) * 0.5 + hash(r * 5 + 1) * 0.2,
          slant: (n2 % 2 ? 1 : -1) * (o.rope.slant ?? 0),
        }
      : { ...o.rope, r: o.rope.r * 0.7, root: 0.02, plait: false }
    const { mesh, lit, t } = sweep(path, rope, hw, (_p, tt) => (tt < 0.2 ? fore : [0, 0, -1]))
    // The top rides the head, the length swings from the back pivot and settles toward the neck as it falls
    // (never the chest: a heavy tail skinned to it would ride the torso's turn and lean).
    const swing = o.swing ?? 0.5
    const swingOf = (tt: number): Weight[] => {
      const w = smooth((tt - 0.08) / 0.4)
      const lay = smooth((tt - 0.45) / 0.55) * (1 - swing)
      return [
        [J.head, 1 - w],
        [J['hair.back'], w * (1 - lay)],
        [J.neck, w * lay],
      ]
    }
    b.hung(mesh, t, top ? 'hair' : 'parting', swingOf, b.nextSeam(), lit, o.matte)
    // A cuff on every other braid near its end, staggered.
    if (o.cuffs && top) {
      const P = spline(path, 20)
      const q = 14 + Math.round(hash(r * 11 + 1) * 4)
      const c = at(P, q)
      const dir = normalize(sub(at(P, q + 1), at(P, q - 1)))
      const cuff = superquadric({
        at: c,
        r: [ar * 1.15, texels(0.03 * g.head, 2) / 2, ar * 1.15],
        e: [0.3, 1],
        seg: 8,
        rings: 4,
        turn: alignY(dir),
      })
      b.hung(
        cuff,
        cuff.positions.filter((_, n) => n % 3 === 0).map(() => 0.85),
        o.cuffs,
        swingOf,
        b.nextSeam(),
      )
      // Tagged: the source has no cuffs at its ppm (decision 4), so the goldens leave them out by this tag.
      parts[parts.length - 1] = { ...at(parts, parts.length - 1), tag: 'cuff' }
    }
  }
  // The tie: a band round the gathered ropes where they rise from the crown, whole texels tall, the pony's
  // root.
  const band = b.tieOf(o.tie)
  if (band)
    parts.push({
      bone: J.head,
      mesh: superquadric({
        at: add(base, scale(up, rise * 0.3)),
        r: [bundle + ar * 1.1, texels(0.05 * g.head) / 2, bundle + ar * 1.1],
        e: [0.25, 1],
        seg: 14,
        rings: 4,
        turn: alignY(up),
      }),
      material: band,
      group: 1,
      seam: b.nextSeam(),
    })
}

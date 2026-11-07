// The shapes every top is cut from: a torso shell from the neck's base to its hem, round over the shoulders;
// a band round it (a hem binding, a rib, a belt); sleeves and cuffs; a collar standing round the neck;
// quilting in chambers; a top's hem and hip as openings; and a top as it is worn in the outfit, for what goes
// over it.
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/streetwear.ts at a1f7246 (`torso`,
// `shellPart`, `hemBand`, `sleeves`, `cuffs`, `collar`, `collarShell`, `pillow`, `quilt`, `chambers`,
// `hemAnchors`, `SLIVER`, `outerHem`, `Worn`, `tops`, `topOf`), with AF's strict types; the formulas and
// their order are the source's.

import type { Anchor, Garment, Measure, Worn } from '@automata/3d/figures-kit'
import {
  at,
  clamp,
  GARMENTS,
  GROUP,
  garmentOf,
  J,
  lerp,
  type Part,
  SIDES,
  type Skeleton,
  smooth,
} from '@automata/3d/figures-kit'
import { frontOf, type Loft, loft, type Section, type Shell, widthOf } from './loft.ts'
import { armSkin, SEAM, skinned, torsoBone, torsoSkin, type Under } from './under.ts'

// The contract type is core's (figures-kit); re-exported so a builder imports it with the helpers.
export type { Worn }

/** A torso shell from the neck's base (`top`) to `hem`: round over the shoulders to `width`, `depth` deep. */
export function torso(
  b: Under,
  top: number,
  hem: number,
  width: (t: number) => number,
  depth: (t: number) => number,
  o: {
    e?: number | ((t: number) => number)
    shoulder?: number
    neck?: number
    bump?: Shell['bump']
  } = {},
): Shell {
  const over = top - (b.armY - (o.shoulder ?? 0.03) * b.k)
  const neck = o.neck ?? b.neck * 1.4
  return {
    from: top,
    to: hem,
    bump: o.bump,
    section: (t) => {
      const y = lerp(top, hem, t)
      const u = clamp((top - y) / over, 0, 1)
      const dome = Math.sqrt(1 - (1 - u) ** 2)
      return {
        c: [0, -0.006 * b.k],
        r: [lerp(neck, width(t), dome), lerp(depth(t) * 0.62, depth(t), dome)],
        e: typeof o.e === 'function' ? o.e(t) : (o.e ?? 0.8),
      }
    },
  }
}
export const shellPart = (
  sh: Shell,
  s: Skeleton,
  material: string,
  seam: number,
  rings: number,
  follow?: number,
): Part =>
  skinned(
    loft('y', sh.from, sh.to, sh.section, { rings, seg: 28, bump: sh.bump }),
    material,
    GROUP.torso,
    seam,
    torsoSkin(s, sh.to, follow),
  )
/** A band round the torso (a hem binding, a rib, a belt) at the shell's own size there, `scale` of it. */
export function hemBand(
  s: Skeleton,
  sh: Shell,
  material: string,
  seam: number,
  top: number,
  bottom: number,
  scale: number,
  bump?: Shell['bump'],
): Part {
  const sectionAt = (y: number) => sh.section(clamp((y - sh.from) / (sh.to - sh.from), 0, 1))
  return skinned(
    loft(
      'y',
      top,
      bottom,
      (t) => {
        const sec = sectionAt(lerp(top, bottom, t))
        return { ...sec, r: [sec.r[0] * scale, sec.r[1] * scale] }
      },
      { rings: 6, seg: 28, bump },
    ),
    material,
    GROUP.torso,
    seam,
    torsoSkin(s, bottom),
  )
}
/** A sleeve down each arm from over the shoulder to `end` (a height), `radius(t)` round, `bump` its quilting;
 * `span` the stretch of it to make (t from, to), for a sleeve sewn in chambers. */
export function sleeves(
  s: Skeleton,
  b: Under,
  material: string,
  end: number,
  radius: (t: number) => number,
  o: {
    bump?: Loft['bump']
    top?: number
    seams?: [number, number]
    rings?: number
    span?: [number, number]
  } = {},
): Part[] {
  const top = b.armY + (o.top ?? 0.05) * b.k
  const [t0, t1] = o.span ?? [0, 1]
  const along = (u: number) => lerp(t0, t1, u)
  const bump = o.bump
  const seams = o.seams ?? [SEAM.sleeveL, SEAM.sleeveR]
  return SIDES.map(([side, x], i) =>
    skinned(
      loft(
        'y',
        lerp(top, end, t0),
        lerp(top, end, t1),
        (u) => {
          const t = along(u)
          const y = lerp(top, end, t)
          const cap = Math.sqrt(1 - (1 - clamp((top - y) / (0.075 * b.k), 0, 1)) ** 2)
          return {
            c: [x * b.g.shoulders, 0],
            r: [radius(t) * lerp(0.55, 1, cap), radius(t) * lerp(0.55, 1, cap) * 1.04],
          }
        },
        { rings: o.rings ?? 14, seg: 14, bump: bump && ((u, v) => bump(along(u), v)) },
      ),
      material,
      side === 'L' ? GROUP.armL : GROUP.armR,
      i === 0 ? seams[0] : seams[1],
      armSkin(s, side, b.k),
    ),
  )
}
/** A cuff at each wrist (or a sleeve's end), from `top` to `bottom`, `r` round. */
export const cuffs = (
  s: Skeleton,
  b: Under,
  material: string,
  top: number,
  bottom: number,
  r: number,
  bump?: Loft['bump'],
): Part[] =>
  SIDES.map(([side, x]) =>
    skinned(
      loft('y', top, bottom, () => ({ c: [x * b.g.shoulders, 0], r: [r, r * 1.04] }), {
        rings: 2,
        seg: 14,
        bump,
      }),
      material,
      side === 'L' ? GROUP.armL : GROUP.armR,
      side === 'L' ? SEAM.cuffL : SEAM.cuffR,
      armSkin(s, side, b.k),
    ),
  )
/** A collar's description (a loft from `top` down to `bottom`, `r` round, standing a little forward at its
 * foot), so a chain can lie over it. */
export const collarShell = (
  b: Under,
  bottom: number,
  top: number,
  r: number,
  bump?: Loft['bump'],
): Shell => ({
  from: top,
  to: bottom,
  bump,
  section: (t): Section => ({
    c: [0, 0.008 * b.k + 0.012 * b.k * (1 - t)],
    r: [r * lerp(0.94, 1, t), r * lerp(0.94, 1, t) * 0.96],
    e: 0.9,
  }),
})
/** A collar standing round the neck from `bottom` to `top`, on the chest and (toward its top) the neck. */
export function collar(
  s: Skeleton,
  b: Under,
  material: string,
  seam: number,
  bottom: number,
  top: number,
  r: number,
  bump?: Loft['bump'],
): Part {
  const neck = at(s.rest, J.neck)[1]
  return skinned(
    loft('y', top, bottom, collarShell(b, bottom, top, r).section, { rings: 6, seg: 24, bump }),
    material,
    GROUP.torso,
    seam,
    (_x, y) => {
      const up = 0.5 * smooth((y - neck + 0.02 * b.k) / (0.06 * b.k))
      return [
        [J.chest, 1 - up],
        [J.neck, up],
      ]
    },
  )
}
/** A baffle's pillow across its own height (u 0 its top stitch, 1 its foot): pinched `depth` of its round at
 * either stitch, fullest a little above its middle. */
export const pillow =
  (depth: number) =>
  (u: number): number =>
    depth * (Math.sin(Math.PI * clamp(u, 0, 1) ** 0.85) ** 0.6 - 1)
/** Quilting along a run cut into `n` chambers: each a pillow. */
export const quilt = (n: number, depth: number): ((t: number) => number) => {
  const p = pillow(depth)
  return (t) => p(t * n - Math.min(n - 1, Math.floor(t * n)))
}
/**
 * A quilted run in chambers: `make(i, from, to)` makes chamber i over its stretch (t from, to), each its own
 * surface.
 */
export function chambers(n: number, make: (i: number, from: number, to: number) => Part[]): Part[] {
  const out: Part[] = []
  for (let i = 0; i < n; i++) out.push(...make(i, i / n, (i + 1) / n))
  return out
}
/** A top's hem at its sides (where a thumb hooks under it, up), and at the hip if the top runs on past it. */
export function hemAnchors(s: Skeleton, sh: Shell): Anchor[] {
  const out: Anchor[] = []
  const k = s.genes.height / 1.62
  const hipY = s.hipY + 0.075 * k
  for (const [side, x] of SIDES) {
    const y = sh.to + 0.004 * k
    const bone = torsoBone(s, y)
    out.push({
      kind: 'hem',
      side,
      bone,
      at: [x * widthOf(sh, y) * 0.92, y, 0.25 * (frontOf(sh, 0, y) ?? 0)],
      open: [0, 1, 0],
    })
    if (sh.to < hipY && hipY < sh.from)
      out.push({ kind: 'hip', side, bone: J.pelvis, at: [x * widthOf(sh, hipY), hipY, 0], open: [-x, 0, 0] })
  }
  return out
}

/** How far under an outer top's hem an inner top may end and still be hidden by it: one ending in that band
 * would show only as a sliver, so it ends at that hem. */
export const SLIVER = 0.04

/** A top as it is worn in the outfit (null for anything else), from the registry. */
export function topOf(m: Measure, s: Skeleton, g: Garment, garments: readonly Garment[]): Worn | null {
  const kind = garmentOf(g)
  return (kind && GARMENTS[kind]?.top?.(m, s, g, garments)) || null
}
/**
 * The lowest edge of the tops worn over `item` (after it in the outfit: a hem band below its shell and all),
 * or null.
 */
export function outerHem(
  m: Measure,
  s: Skeleton,
  item: Garment,
  garments: readonly Garment[],
): number | null {
  let hem: number | null = null
  for (const g of garments.slice(garments.indexOf(item) + 1)) {
    const w = topOf(m, s, g, garments)
    if (w) hem = Math.min(hem ?? Infinity, w.shell.to, w.foot ?? w.shell.to)
  }
  return hem
}
/** Every top in an outfit as they are put on (the last outermost), and the neck the outermost leaves. */
export function tops(
  m: Measure,
  s: Skeleton,
  b: Under,
  garments: readonly Garment[],
): { shells: Worn[]; neck: number } {
  const out: { shells: Worn[]; neck: number } = { shells: [], neck: b.neck * 1.3 }
  for (const g of garments) {
    const p = topOf(m, s, g, garments)
    if (p) {
      out.shells.push(p)
      out.neck = p.neck
    }
  }
  return out
}

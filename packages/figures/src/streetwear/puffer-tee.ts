// The cropped puffer (quilted baffles, a high collar, full sleeves) and the oversized tee (dropped shoulders,
// a boxy hang), each cut from the measure and grown round what it goes on over (layering.ts).
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/streetwear.ts at a1f7246
// (`pufferShell`, `puffer`, `teeShell`, `tee`), with AF's strict types; the formulas and their order are the
// source's. Cut: graphics (SNEKPRTY marks). Changed: painter materials are swatch variants, and a mark the
// source draws at two sizes by density is one decal at its density-2 size (M3.5b decision 4).

import type { Anchor } from '../build/anchors'
import type { Garment, Puffer, Tee } from '../figure/garment.schema'
import { SIDES } from '../garments/head'
import type { Measure } from '../genes/genes'
import { clamp, lerp, normalize, smooth } from '../math/math'
import { type Decal, GROUP, type Part } from '../parts/mesh'
import { J, type Skeleton } from '../rig/rig'
import { over, underneath } from './layering'
import { frontOf, loft, widthOf } from './loft'
import {
  chambers,
  collar,
  collarShell,
  cuffs,
  hemAnchors,
  hemBand,
  outerHem,
  pillow,
  quilt,
  SLIVER,
  shellPart,
  sleeves,
  torso,
  type Worn,
} from './tops'
import {
  type Fit,
  local,
  own,
  SEAM,
  skinned,
  torsoBone,
  torsoSkin,
  under,
  type Wearing,
  wholeTop,
} from './under'

// ─── The puffer ───
interface PufferShell extends Worn {
  top: number
  hem: number
  D: number
  collarTop: number
  collarBot: number
  collarR: number
  ring: (t: number, v: number) => number
}
/** The puffer's body: level baffles round it, the shoulders' dome the first. */
export function pufferShell(
  m: Measure,
  s: Skeleton,
  item: Puffer,
  garments: readonly Garment[],
): PufferShell {
  const b = under(m, s)
  const { g, k } = b
  const top = s.shoulderY + 0.016 * k
  const hem = lerp(b.spineY - 0.01 * k, s.hipY + 0.06 * k, item.length ?? 0)
  const W = g.shoulders * 1.24 + 0.02 * k
  const D = b.depth + 0.07 * k
  const puff = quilt(item.baffles ?? 4, 0.3)
  // The high collar: two baffles standing to the jaw, a little fuller than the neck's round.
  const collarTop = s.chinY + 0.012 * k
  const collarBot = s.shoulderY - 0.03 * k
  const collarR = b.neck * 1.5 + 0.034 * k
  const ring = (t: number, v: number) => pillow(0.18)(t) + 0.05 + 0.02 * Math.sin(v)
  const whole = quilt(2, 0.18)
  return {
    shell: over(
      m,
      torso(
        b,
        top,
        hem,
        (t) => W * lerp(1, 0.93, t),
        (t) => D * lerp(1, 0.92, t),
        { e: 0.85, bump: (t) => puff(t), neck: b.neck * 1.8 },
      ),
      underneath(m, s, item, garments, hem),
    ),
    cloth: item.puffer,
    neck: b.neck * 1.5 + 0.045 * k,
    top,
    hem,
    D,
    collarTop,
    collarBot,
    collarR,
    ring,
    collar: collarShell(b, collarBot, collarTop, collarR, (t, v) => whole(t) + 0.05 + 0.02 * Math.sin(v)),
    foot: hem - 0.026 * k,
  }
}
export function puffer(w: Wearing, item: Puffer): Fit {
  const { m, s } = w
  const b = under(m, s)
  const { k } = b
  const cloth = item.puffer
  const trim = item.trim ?? cloth
  const n = item.baffles ?? 4
  const { shell: sh, top, hem, D, collarTop, collarBot, collarR, ring } = pufferShell(m, s, item, w.garments)
  // The body's baffles, level round it, each its own sewn chamber.
  const parts: Part[] = chambers(n, (i, t0, t1) => [
    skinned(
      loft('y', lerp(sh.from, sh.to, t0), lerp(sh.from, sh.to, t1), (u) => sh.section(lerp(t0, t1, u)), {
        rings: 8,
        seg: 28,
        bump: (u, v) => sh.bump?.(lerp(t0, t1, u), v) ?? 0,
      }),
      cloth,
      GROUP.torso,
      SEAM.baffle + i,
      torsoSkin(s, sh.to),
    ),
  ])
  // The hem's binding, gathered in under the last baffle.
  parts.push(hemBand(s, sh, trim, SEAM.hem, hem + 0.006 * k, hem - 0.026 * k, 0.86))
  parts.push(
    ...chambers(2, (i, t0, t1) => [
      collar(
        s,
        b,
        cloth,
        SEAM.baffle + 10 + i,
        lerp(collarTop, collarBot, t1),
        lerp(collarTop, collarBot, t0),
        collarR,
        ring,
      ),
    ]),
  )
  // Full sleeves, quilted round the arm in six chambers, cuffed at the wrist; past the elbow a fifth slimmer
  // than over the upper arm, so a hand on the hip opens air between arm and waist.
  const cuffTop = b.wristY + 0.05 * k
  const elbow = (b.armY + 0.05 * k - b.elbowY) / (b.armY + 0.05 * k - cuffTop)
  const arms = quilt(6, 0.22)
  const sleeveR = (t: number) =>
    lerp(b.arm * 1.75, b.fore * 1.75, t) * lerp(1, 0.86, smooth((t - elbow + 0.1) / 0.2)) + 0.01 * k
  parts.push(
    ...chambers(6, (i, t0, t1) =>
      sleeves(s, b, cloth, cuffTop, sleeveR, {
        bump: arms,
        span: [t0, t1],
        rings: 7,
        seams: [SEAM.baffle + 20 + i, SEAM.baffle + 30 + i],
      }),
    ),
  )
  parts.push(...cuffs(s, b, trim, cuffTop + 0.01 * k, b.wristY + 0.006 * k, b.fore * 1.18))
  // The zip: centre front from the collar's top to the binding, its pull at the chin.
  const decals: Decal[] = []
  const zip = item.zip ?? 'chrome'
  for (let y = collarTop - 0.006 * k; y > hem + 0.006 * k; y -= 0.004) {
    const z = y > top - 0.03 * k ? 0.02 * k + collarR * 1.03 : (frontOf(sh, 0, y) ?? D) + 0.002
    const bone = y > top - 0.03 * k ? J.chest : torsoBone(s, y)
    decals.push({ bone, at: local(s, bone, [0, y, z]), normal: [0, 0, 1], material: zip })
  }
  decals.push({
    bone: J.chest,
    at: local(s, J.chest, [0.012 * k, collarTop - 0.028 * k, 0.02 * k + collarR * 1.05]),
    normal: [0, 0, 1],
    material: 'chrome',
    size: [1, 2],
  })
  // The handwarmers: a welt slanting down each side of the last baffle toward the hem, the hands in at its
  // top.
  const anchors: Anchor[] = [...hemAnchors(s, sh)]
  const wy = lerp(sh.from, sh.to, 1 - 0.5 / n)
  for (const [side, x] of SIDES) {
    const wx = x * widthOf(sh, wy) * 0.78
    const bone = torsoBone(s, wy)
    anchors.push({
      kind: 'jacketPocket',
      side,
      bone,
      at: [wx, wy, (frontOf(sh, wx, wy) ?? D) * 0.9],
      open: normalize([-x * 0.35, -0.9, -0.3]),
    })
  }
  return { parts, decals, anchors, paint: wholeTop(cloth) }
}

// ─── The tee ───
/** The tee's body: boxy, as wide at the hem as at the chest, hanging in soft folds that deepen toward it;
 * dropped shoulders. `length` 0 ends it at the waistband. Under an outer top it ends at that top's hem if it
 * would end just below it; longer, it hangs on below it at its own length. */
export function teeShell(m: Measure, s: Skeleton, item: Tee, garments: readonly Garment[]): Worn {
  const b = under(m, s)
  const { g, k } = b
  const fit = item.fit ?? 1.16
  // Under a jacket (no sleeves) it lies closer, so the jacket clears it.
  const close = item.sleeves === false
  const ease = close ? 0.4 : 1
  const top = s.shoulderY + 0.008 * k
  const W = g.shoulders * fit + 0.012 * k * ease
  const D = b.depth + 0.032 * k * ease
  let hem = lerp(s.hipY + 0.12 * k, s.hipY - 0.075 * k, item.length ?? 1)
  const outer = outerHem(m, s, item, garments)
  if (outer !== null && hem < outer && hem > outer - SLIVER * k) hem = outer + 0.006 * k
  const tOut = outer !== null && hem < outer ? (top - outer) / (top - hem) : 1
  // Its folds hang at the sides and the back; the front, where the chest holds it out, half as deep.
  const folds = (t: number, v: number) =>
    ease *
    (close ? 0.25 : 1) *
    (1 - 0.5 * Math.max(0, Math.sin(v))) *
    (0.05 * smooth((t - 0.3) / 0.7) * Math.sin(5 * v + 1.1) + 0.02 * Math.sin(9 * v + 0.4) * t)
  // Close, it takes in at the waist as the jacket over it does; loose, it hangs as a box, never a flare.
  const width = (t: number) => W * (close ? lerp(1, 0.88, smooth(Math.min(t, tOut) * 1.3)) : 1)
  const depth = (t: number) => D * (close ? lerp(0.96, 0.92, Math.min(t, tOut)) : 0.96)
  const box = close ? undefined : clamp((top - b.armY) / (top - hem), 0, 1)
  return {
    shell: over(
      m,
      torso(b, top, hem, width, depth, {
        e: (t) => lerp(0.72, close ? 0.72 : 0.58, smooth((t - 0.4) / 0.6)),
        shoulder: -0.01,
        neck: b.neck * 1.35,
        bump: folds,
      }),
      underneath(m, s, item, garments, hem),
      box,
    ),
    cloth: item.tee,
    neck: b.neck * 1.4,
    collar: collarShell(b, s.shoulderY - 0.012 * k, s.shoulderY + 0.018 * k, b.neck * 1.32),
  }
}
export function tee(w: Wearing, item: Tee): Fit {
  const { m, s } = w
  const b = under(m, s)
  const { k } = b
  const cloth = item.tee
  const rib = item.rib ?? own(w.made, cloth, 'rib')
  const { shell: sh } = teeShell(m, s, item, w.garments)
  const parts: Part[] = [shellPart(sh, s, cloth, SEAM.under, 18, 0.8)]
  // The crew neck's rib.
  parts.push(
    collar(s, b, rib, SEAM.underRib, s.shoulderY - 0.012 * k, s.shoulderY + 0.018 * k, b.neck * 1.32),
  )
  // Sleeves from the dropped shoulder to the elbow, wide and square-cut.
  const sleeveEnd = b.elbowY + 0.03 * k
  const sleeveR = (t: number) => b.arm * lerp(1.5, 1.62, t) + 0.006 * k
  if (item.sleeves !== false)
    parts.push(
      ...sleeves(s, b, cloth, sleeveEnd, sleeveR, {
        top: 0.03,
        seams: [SEAM.underSleeveL, SEAM.underSleeveR],
        rings: 8,
      }),
    )
  return {
    parts,
    decals: [],
    anchors: hemAnchors(s, sh),
    paint: {
      chest: cloth,
      waist: cloth,
      shoulder: cloth,
      ...(item.sleeves !== false ? { upper: cloth } : {}),
    },
  }
}

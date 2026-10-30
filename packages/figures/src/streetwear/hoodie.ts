// The hoodie: the hood lying on the back, its opening rolled either side of the neck, a kangaroo pocket,
// drawstrings, a ribbed hem and cuffs, sleeves sewn on at a dropped shoulder.
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/streetwear.ts at a1f7246
// (`hoodieShell`, `hoodRoll`, `hoodie`), with AF's strict types; the formulas and their order are the
// source's. Cut: graphics (SNEKPRTY marks). Changed: painter materials are swatch variants; the aglet, drawn
// at two sizes by density, is one decal at its density-2 size (M3.5b decision 4).

import type { Anchor } from '../build/anchors'
import type { Garment, Hoodie } from '../figure/garment.schema'
import { GARMENT_DEFAULTS } from '../figure/garment-defaults'
import { SIDES } from '../garments/head'
import type { Measure } from '../genes/genes'
import { sweep } from '../hair/sweep'
import { clamp, lerp, normalize, smooth, type V3 } from '../math/math'
import { type Decal, GROUP, type Part, sgnPow, type Weight } from '../parts/mesh'
import { at, J, type Skeleton } from '../rig/rig'
import { over, underneath } from './layering'
import { angleAt, frontOf, loft, type Shell } from './loft'
import { collarShell, cuffs, hemAnchors, hemBand, shellPart, sleeves, torso, type Worn } from './tops'
import {
  type Fit,
  local,
  own,
  SEAM,
  skinned,
  tone,
  torsoBone,
  torsoSkin,
  under,
  type Wearing,
  wholeTop,
} from './under'

// ─── The hoodie ───
interface HoodieShell extends Worn {
  hem: number
  W: number
  D: number
  top: number
  rimR: number
}
export function hoodieShell(
  m: Measure,
  s: Skeleton,
  item: Hoodie,
  garments: readonly Garment[],
): HoodieShell {
  const b = under(m, s)
  const { g, k } = b
  const top = s.shoulderY + 0.01 * k
  const hem = s.hipY - 0.03 * k
  const W = g.shoulders * 1.12 + 0.014 * k
  const D = b.depth + 0.04 * k
  // Fleece: a soft fold or two at the belly, the body blousing over the rib, which hangs below it and clears
  // the seat.
  const hipW = Math.max(W * 1.04, b.hips * 1.06 + 0.03 * k)
  const rimR = b.neck * 1.5 + 0.03 * k
  return {
    shell: over(
      m,
      torso(
        b,
        top,
        hem + 0.04 * k,
        (t) => lerp(W, hipW, smooth(t)),
        (t) => D * lerp(1, 1.06, t),
        { e: 0.8, bump: (t, v) => 0.02 * smooth((t - 0.5) / 0.5) * Math.sin(4 * v + 0.6) },
      ),
      underneath(m, s, item, garments, hem),
    ),
    cloth: item.hoodie,
    neck: b.neck * 1.55 + 0.035 * k,
    hem,
    W,
    D,
    top,
    rimR,
    collar: collarShell(b, s.shoulderY - 0.035 * k, s.shoulderY + 0.03 * k, rimR * 1.12),
    foot: hem,
  }
}
/** The hood's opening: a roll of the cloth either side of the neck, from high behind the nape round the
 * neck's side and down to the throat, where the two cross in a V (side `x`, the wearer's left lying over).
 * Its path in rest figure space. */
function hoodRoll(s: Skeleton, k: number, R: number, x: number): V3[] {
  const y0 = s.shoulderY
  const path: V3[] = []
  for (let i = 0; i <= 24; i++) {
    // θ from the nape (0) round the side (π/2) to the throat (π), and a little past it, over the other roll.
    const th = ((Math.PI + 0.32) * i) / 24
    const f = smooth((th - Math.PI * 0.45) / (Math.PI * 0.55))
    const y = lerp(y0 + 0.03 * k, y0 + 0.002 * k, smooth(th / (Math.PI * 0.5))) - 0.085 * k * f ** 1.4
    const r = R * lerp(1, 0.55, f ** 1.2)
    path.push([x * r * Math.sin(th), y, -r * Math.cos(th) * 0.92 + 0.012 * k + (x > 0 ? 0.004 : 0) * k * f])
  }
  return path
}
export function hoodie(w: Wearing, item: Hoodie): Fit {
  const { m, s, made } = w
  const b = under(m, s)
  const { k } = b
  const cloth = item.hoodie
  // By role: the rib and the inside its file names, else the fleece's own.
  const rib = item.rib ?? own(made, cloth, 'rib')
  const inside = item.inside ?? own(made, cloth, 'inside')
  const cords = item.cords ?? rib
  const { shell: sh, hem, D, top, rimR } = hoodieShell(m, s, item, w.garments)
  const parts: Part[] = [shellPart(sh, s, cloth, SEAM.shell, 18, 0.4)]
  const ribs = (_t: number, v: number) => 0.025 * Math.sin(40 * v)
  // The rib pulled in under the body, so the fleece blouses over it.
  parts.push(hemBand(s, sh, rib, SEAM.hem, hem + 0.046 * k, hem, 0.86, ribs))
  // The hood's opening, a roll each side crossing at the throat; the hood itself lying flat down the upper
  // back to a point at mid shoulder blade; the lining at its fold.
  const neck = at(s.rest, J.neck)[1]
  const rimSkin = (_x: number, y: number): Weight[] => {
    const up = 0.5 * smooth((y - neck + 0.02 * k) / (0.06 * k))
    return [
      [J.chest, 1 - up],
      [J.neck, up],
    ]
  }
  const rollR = 0.026 * k
  const edge = tone(made, cloth, 'hoodEdge', 3)
  const foot: Decal[] = []
  for (const [side, x] of SIDES) {
    const path = hoodRoll(s, k, rimR * 1.12, x)
    const roll = sweep(
      path,
      { r: 1, flat: 0.75, e: 0.9, tip: 'round' },
      rollR,
      (p: V3) => [p[0], 0.05, p[2]],
      26,
    ).mesh
    parts.push(skinned(roll, cloth, GROUP.torso, side === 'L' ? SEAM.collar : SEAM.rimR, rimSkin))
    // The roll's foot across the chest, where it lies on the fleece: a mark of the cloth's deepest under it.
    for (const p of path)
      if (p[2] > 0.02 * k) {
        const y = p[1] - rollR * 0.95
        const z = frontOf(sh, p[0], y)
        if (z !== null)
          foot.push({
            bone: J.chest,
            at: local(s, J.chest, [p[0], y, z + 0.001]),
            normal: [0, 0.2, 1],
            material: edge,
          })
      }
  }
  // The hood's lining in its opening: the cloth inside the rolls' V, from the neck down to where they cross,
  // in the inside's tone (where the shell stands in front of the neck).
  const arm = hoodRoll(s, k, rimR * 1.12, 1)
    .filter((p) => p[2] > 0)
    .sort((p, q) => p[1] - q[1])
  const armX = (y: number) => {
    const i = arm.findIndex((p) => p[1] >= y)
    if (i <= 0) return i ? at(arm, arm.length - 1)[0] : at(arm, 0)[0]
    const p = at(arm, i - 1)
    const q = at(arm, i)
    return lerp(p[0], q[0], (y - p[1]) / (q[1] - p[1] || 1))
  }
  for (let y = at(arm, 0)[1] + rollR * 0.6; y < top; y += 0.005) {
    const xi = armX(y) - rollR * 0.9
    for (let x = -xi; x <= xi; x += 0.005) {
      const z = frontOf(sh, x, y)
      if (z !== null && z > b.neck * 1.05)
        foot.push({
          bone: J.chest,
          at: local(s, J.chest, [x, y, z + 0.001]),
          normal: normalize([x * 4, 0.4, 1]),
          material: inside,
        })
    }
  }
  const hTop = top - 0.012 * k
  const hBot = s.shoulderY - 0.2 * k
  const BACK = -Math.PI / 2
  const off = (u: number) => lerp(0.034, 0.02, u) * k
  const hood: Shell = {
    from: hTop,
    to: hBot,
    section: (u) => {
      const sec = sh.section((lerp(hTop, hBot, u) - sh.from) / (sh.to - sh.from))
      return { ...sec, r: [sec.r[0] + off(u), sec.r[1] + off(u)] }
    },
  }
  const spread = (u: number) => lerp(1.08, 0.1, u ** 1.15)
  parts.push(
    skinned(
      loft('y', hTop, hBot, hood.section, {
        rings: 10,
        seg: 16,
        arc: (u) => [BACK - spread(u), BACK + spread(u)],
      }),
      cloth,
      GROUP.torso,
      SEAM.hood,
      torsoSkin(s, hem, 0.4),
    ),
  )
  const liningFrom = top + 0.004 * k
  const liningTo = hTop + 0.006 * k
  const lining: Shell = {
    from: liningFrom,
    to: liningTo,
    section: (u) => {
      const sec = sh.section(clamp((lerp(liningFrom, liningTo, u) - sh.from) / (sh.to - sh.from), 0, 1))
      return { ...sec, r: [sec.r[0] + 0.03 * k, sec.r[1] + 0.03 * k] }
    },
  }
  parts.push(
    skinned(
      loft('y', lining.from, lining.to, lining.section, {
        rings: 2,
        seg: 14,
        arc: () => [BACK - 1.05, BACK + 1.05],
      }),
      inside,
      GROUP.torso,
      SEAM.hoodInside,
      torsoSkin(s, hem, 0.4),
    ),
  )
  const decals: Decal[] = [...foot]
  // The hood's centre seam, from its fold down to its point, in the rib's tone; its edge, the cloth's
  // deepest.
  const onHood = (u: number, v: number): V3 => {
    const sec = hood.section(u)
    return [
      sec.c[0] + sgnPow(Math.cos(v), sec.e ?? 1) * sec.r[0],
      lerp(hTop, hBot, u),
      sec.c[1] + sgnPow(Math.sin(v), sec.e ?? 1) * sec.r[1],
    ]
  }
  for (let u = 0.06; u < 0.92; u += 0.02) {
    const p = onHood(u, BACK)
    const bone = torsoBone(s, p[1])
    decals.push({ bone, at: local(s, bone, [p[0], p[1], p[2] - 0.001]), normal: [0, 0.3, -1], material: rib })
    for (const x of [-1, 1]) {
      const v = BACK + x * spread(u) * 0.96
      const q = onHood(u, v)
      decals.push({
        bone,
        at: local(s, bone, q),
        normal: normalize([Math.cos(v), 0.2, Math.sin(v)]),
        material: edge,
      })
    }
  }
  hoodiePocket(s, k, sh, { cloth, hem, D, edge, rib }, parts, decals)
  const anchors: Anchor[] = [...hemAnchors(s, sh), ...pocketAnchors(s, k, sh, hem, D)]
  // Drawstrings out of the hood's opening through an eyelet either side of the V where the rolls cross,
  // hanging down the chest well apart, each ending in an aglet.
  const vy = s.shoulderY - 0.06 * k
  for (const [, x] of SIDES) {
    const x0 = x * 0.03 * k
    const y0 = vy
    const y1 = y0 - 0.1 * k
    decals.push({
      bone: J.chest,
      at: local(s, J.chest, [x0, y0 + 0.006 * k, (frontOf(sh, x0, y0) ?? D) + 0.006 * k]),
      normal: [0, 0.2, 1],
      material: edge,
    })
    for (let y = y0; y > y1; y -= 0.004)
      decals.push({
        bone: J.chest,
        at: local(s, J.chest, [
          x0 + (x * 0.008 * k * (y0 - y)) / (y0 - y1),
          y,
          (frontOf(sh, x0, y) ?? D) + 0.004,
        ]),
        normal: [0, 0, 1],
        material: cords,
      })
    decals.push({
      bone: J.chest,
      at: local(s, J.chest, [x0 + x * 0.008 * k, y1 - 0.006 * k, (frontOf(sh, x0, y1) ?? D) + 0.004]),
      normal: [0, 0, 1],
      material: item.aglets ?? GARMENT_DEFAULTS.hoodie.aglets,
      size: [1, 2],
    })
  }
  // Sleeves: roomy, blousing over ribbed cuffs, sewn on at a dropped shoulder: the seam a line of the rib's
  // tone.
  const cuffTop = b.wristY + 0.055 * k
  const sleeveTop = b.armY + 0.05 * k
  const sleeveR = (t: number) =>
    lerp(b.arm * 1.32, b.fore * 1.42, t) * (1 + 0.08 * smooth((t - 0.7) / 0.3)) + 0.004 * k
  parts.push(...sleeves(s, b, cloth, cuffTop, sleeveR, { rings: 14 }))
  parts.push(...cuffs(s, b, rib, cuffTop + 0.004 * k, b.wristY + 0.004 * k, b.fore * 1.12, ribs))
  const seamY = b.armY - 0.035 * k
  const seamR = sleeveR((sleeveTop - seamY) / (sleeveTop - cuffTop)) * 1.02
  for (const [side, x] of SIDES) {
    const bone = J[`upperArm.${side}`]
    for (let v = -0.2; v <= Math.PI + 0.2; v += 0.12)
      decals.push({
        bone,
        at: local(s, bone, [
          x * s.genes.shoulders + Math.cos(v) * seamR,
          seamY + 0.01 * k * Math.cos(v) * x,
          Math.sin(v) * seamR * 1.04,
        ]),
        normal: [Math.cos(v), 0, Math.sin(v)],
        material: rib,
      })
  }
  return { parts, decals, anchors, paint: wholeTop(cloth) }
}

/** The kangaroo pocket: a patch on the belly, narrower at the top, its slanted hand openings at the sides. */
function kangaroo(s: Skeleton, k: number, sh: Shell, hem: number) {
  const pTop = at(s.rest, J.spine)[1] - 0.005 * k
  const pBot = hem + 0.058 * k
  const pw = (t: number) => lerp(0.085, 0.125, t) * k
  const pocket: Shell = {
    from: pTop,
    to: pBot,
    section: (t) => {
      const sec = sh.section((lerp(pTop, pBot, t) - sh.from) / (sh.to - sh.from))
      return { ...sec, r: [sec.r[0] + 0.012 * k, sec.r[1] + 0.014 * k] }
    },
  }
  // The opening's place at u down it (0 just under the pocket's top), on side x.
  const opening = (x: number, u: number): [number, number] => [
    x * (lerp(0.085, 0.118, u) * k - 0.004 * k),
    lerp(pTop - 0.012 * k, pBot + 0.03 * k, u),
  ]
  return { pTop, pBot, pw, pocket, opening }
}
/** The hands in at each opening's middle, toward the pocket's middle. */
function pocketAnchors(s: Skeleton, k: number, sh: Shell, hem: number, D: number): Anchor[] {
  const { pocket, opening } = kangaroo(s, k, sh, hem)
  return SIDES.map(([side, x]): Anchor => {
    const [xx, y] = opening(x, 0.5)
    return {
      kind: 'bellyPocket',
      side,
      bone: torsoBone(s, y),
      at: [xx, y, frontOf(pocket, xx, y) ?? D],
      open: normalize([-x, -0.25, -0.2]),
    }
  })
}
/** The pocket's patch, its openings' edges and its stitched top edge. */
function hoodiePocket(
  s: Skeleton,
  k: number,
  sh: Shell,
  o: { cloth: string; hem: number; D: number; edge: string; rib: string },
  parts: Part[],
  decals: Decal[],
): void {
  const { pTop, pBot, pw, pocket, opening } = kangaroo(s, k, sh, o.hem)
  parts.push(
    skinned(
      loft('y', pTop, pBot, pocket.section, {
        rings: 6,
        seg: 12,
        arc: (t) => {
          const sec = pocket.section(t)
          return [angleAt(sec, pw(t)), angleAt(sec, -pw(t))]
        },
      }),
      o.cloth,
      GROUP.torso,
      SEAM.pocket,
      torsoSkin(s, o.hem, 0.4),
    ),
  )
  for (const [, x] of SIDES)
    for (let u = 0; u <= 1; u += 0.04) {
      const [xx, y] = opening(x, u)
      const z = (frontOf(pocket, xx, y) ?? o.D) + 0.001
      const bone = torsoBone(s, y)
      decals.push({ bone, at: local(s, bone, [xx, y, z]), normal: [x * 0.4, 0, 0.9], material: o.edge })
    }
  // Its top edge, stitched in the rib's tone.
  for (let x = -pw(0); x <= pw(0); x += 0.004)
    decals.push({
      bone: J.spine,
      at: local(s, J.spine, [x, pTop - 0.004 * k, (frontOf(pocket, x, pTop - 0.004 * k) ?? o.D) + 0.001]),
      normal: [0, 0.3, 1],
      material: o.rib,
    })
}

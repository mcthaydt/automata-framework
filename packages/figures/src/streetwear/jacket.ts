// The moto jacket: cropped to the waist and cut close, open at the neck in a V to an asymmetric zip, notched
// lapels folded back either side of it, epaulettes, a zipped chest pocket and two slant pockets, zipped
// cuffs, a belted hem, a yoked and panelled back.
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/streetwear.ts at a1f7246
// (`jacketShell`, `jacket`), with AF's strict types; the formulas and their order are the source's. Cut:
// graphics (SNEKPRTY marks). Changed: painter materials (the folded hide, its lit edge, the notch, the
// metal's teeth and pulls, seams) are swatch variants, and a mark the source draws at two sizes by density is
// one decal at its density-2 size (M3.5b decision 4).

import type { Anchor } from '../build/anchors'
import { variant } from '../build/materials'
import type { Garment, Jacket } from '../figure/garment.schema'
import { GARMENT_DEFAULTS } from '../figure/garment-defaults'
import { SIDES } from '../garments/head'
import type { Measure } from '../genes/genes'
import { axisAngle, clamp, lerp, normalize, smooth, type V3 } from '../math/math'
import { type Decal, GROUP, type Part } from '../parts/mesh'
import { at, J, type Skeleton } from '../rig/rig'
import { over, underneath } from './layering'
import { angleAt, frontOf, loft, type Section, type Shell, topAt, widthOf } from './loft'
import { hemAnchors, hemBand, sleeves, torso, type Worn } from './tops'
import {
  type Fit,
  local,
  onShell,
  piece,
  SEAM,
  skinned,
  stroke,
  tone,
  torsoBone,
  torsoSkin,
  under,
  type Wearing,
  wholeTop,
  zipAt,
} from './under'

// ─── The moto jacket ───
interface JacketShell extends Worn {
  edges: (y: number) => [number, number] | null
  top: number
  hem: number
  D: number
  zx: number
  zipTop: number
}
/**
 * The moto's body: cropped to the waist and cut close, open at the neck in a V down to the zip's top, which
 * sits off the centre on the wearer's left (the asymmetric zip), so the V slants and the tee shows in it.
 * `edges(y)` the V's two edges (x, right then left) where it is open.
 */
export function jacketShell(
  m: Measure,
  s: Skeleton,
  item: Jacket,
  garments: readonly Garment[],
): JacketShell {
  const b = under(m, s)
  const { g, k } = b
  const top = s.shoulderY + 0.01 * k
  const hem = s.hipY + 0.07 * k
  const W = g.shoulders * 1.04 + 0.016 * k
  const D = b.depth + 0.03 * k
  const zx = 0.1 * k
  const zipTop = b.chestY - 0.065 * k
  const neck = b.neck * 1.4
  const edges = (y: number): [number, number] | null => {
    if (y <= zipTop) return null
    const u = clamp((y - zipTop) / (top - zipTop), 0, 1)
    // Narrow: the lapels lie nearly closed over the chest and part only toward the collar.
    return [lerp(zx, -neck * 1.15, u ** 1.4), lerp(zx, neck * 1.15, u ** 1.4)]
  }
  // Cut close: from the chest in to the belted waist, an eighth narrower.
  const taper = (t: number) => lerp(1, 0.87, smooth((t - 0.2) / 0.65))
  const shell = over(
    m,
    torso(
      b,
      top,
      hem,
      (t) => W * taper(t),
      (t) => D * lerp(1, 0.94, smooth((t - 0.2) / 0.6)),
      { e: 0.78 },
    ),
    underneath(m, s, item, garments, hem),
  )
  return {
    shell: {
      ...shell,
      open: (x, y) => {
        const e = edges(y)
        return !!e && x > e[0] && x < e[1]
      },
    },
    cloth: item.jacket,
    edges,
    neck: b.neck * 1.45 + 0.03 * k,
    top,
    hem,
    D,
    zx,
    zipTop,
  }
}
export function jacket(w: Wearing, item: Jacket): Fit {
  const { m, s, made } = w
  const b = under(m, s)
  const { k } = b
  const cloth = item.jacket
  const hardware = item.hardware ?? GARMENT_DEFAULTS.jacket.hardware
  const zip = item.zip ?? GARMENT_DEFAULTS.jacket.zip
  const { shell: sh, edges, hem, top, D, zx, zipTop } = jacketShell(m, s, item, w.garments)
  // The lapels, the collar and the belt are the hide folded: matte, parted from the panels by the light along
  // their folded edges, a mark three steps up the hide's own light.
  const folded = variant(made, cloth, 'lapel', { matte: true })
  const edgeCloth = variant(made, cloth, 'edge', { flat: true, shade: 4 })
  const notch = tone(made, cloth, 'notch', 3)
  // The body: whole round below the zip's top, open across the V above it.
  const arc = (t: number): [number, number] => {
    const y = lerp(sh.from, sh.to, t)
    const sec = sh.section(t)
    const e = edges(y)
    if (!e) {
      const a = angleAt(sec, zx)
      return [a, a + 2 * Math.PI]
    }
    return [angleAt(sec, e[0]), angleAt(sec, e[1]) + 2 * Math.PI]
  }
  const parts: Part[] = [
    skinned(
      loft('y', sh.from, sh.to, sh.section, { rings: 24, seg: 32, arc }),
      cloth,
      GROUP.torso,
      SEAM.shell,
      torsoSkin(s, sh.to),
    ),
  ]
  // The belt round the hem, and its buckle on the wearer's right, stood off it.
  const beltTop = hem + 0.034 * k
  parts.push(hemBand(s, sh, folded, SEAM.belt, beltTop, hem - 0.004 * k, 1.05))
  const by = hem + 0.015 * k
  const bx = -0.085 * k
  const bz = (frontOf(sh, bx, by) ?? D) * 1.035 + 0.006 * k
  parts.push(
    piece(J.pelvis, hardware, GROUP.torso, SEAM.buckle, {
      at: local(s, J.pelvis, [bx, by, bz]),
      r: [0.012 * k, 0.012 * k, 0.005 * k],
      e: [0.3, 0.3],
      turn: axisAngle([0, 1, 0], -0.35),
      seg: 8,
      rings: 4,
    }),
  )
  // The collar: lying round the neck from the nape to the V's top, its points at the lapels' tops (the notch
  // between).
  const cTop = top + 0.024 * k
  const cBot = top - 0.03 * k
  const cR = b.neck * 1.45 + 0.016 * k
  const collarSec = (u: number): Section => ({
    c: [0, 0.006 * k - 0.016 * k * u],
    r: [cR * lerp(0.92, 1.25, u), cR * lerp(0.92, 1.16, u)],
    e: 0.85,
  })
  const neckY = at(s.rest, J.neck)[1]
  parts.push(
    skinned(
      loft('y', cTop, cBot, collarSec, {
        rings: 4,
        seg: 24,
        arc: (u) => {
          const sec = collarSec(u)
          return [
            angleAt(sec, -cR * lerp(0.75, 0.95, u)),
            angleAt(sec, cR * lerp(0.75, 0.95, u)) + 2 * Math.PI,
          ]
        },
      }),
      folded,
      GROUP.torso,
      SEAM.collar,
      (_x, y) => {
        const up = 0.5 * smooth((y - neckY + 0.02 * k) / (0.06 * k))
        return [
          [J.chest, 1 - up],
          [J.neck, up],
        ]
      },
    ),
  )
  // The lapels: folded back along each edge of the V, wide at the collar and narrowing to the zip's top,
  // standing off the body by the leather's fold; the light along each one's folded outer edge.
  const decals: Decal[] = []
  const lTop = cBot - 0.006 * k
  SIDES.forEach(([side, x], i) => {
    const stand = 0.013 * k
    const lapel: Shell = {
      from: lTop,
      to: zipTop,
      section: (t) => {
        const sec = sh.section((lerp(lTop, zipTop, t) - sh.from) / (sh.to - sh.from))
        return { ...sec, r: [sec.r[0] + stand, sec.r[1] + stand] }
      },
    }
    const inner = (t: number) => edges(lerp(lTop, zipTop, t))?.[i === 0 ? 1 : 0] ?? zx
    const width = (t: number) => lerp(0.1, 0.008, t ** 0.7) * k * (x > 0 ? 0.85 : 1)
    const outer = (t: number) => inner(t) + x * width(t)
    parts.push(
      skinned(
        loft('y', lTop, zipTop, lapel.section, {
          rings: 8,
          seg: 6,
          arc: (t) => {
            const sec = lapel.section(t)
            const a = angleAt(sec, inner(t))
            const c = angleAt(sec, outer(t))
            return a < c ? [a, c] : [c, a]
          },
        }),
        folded,
        GROUP.torso,
        side === 'L' ? SEAM.lapelL : SEAM.lapelR,
        torsoSkin(s, hem),
      ),
    )
    for (let t = 0.04; t <= 0.85; t += 0.03) {
      const y = lerp(lTop, zipTop, t)
      const xx = lerp(inner(t), outer(t), 0.88)
      const bone = torsoBone(s, y)
      decals.push({
        bone,
        at: local(s, bone, [xx, y, (frontOf(lapel, xx, y) ?? D) + 0.002]),
        normal: [0, 0, 1],
        material: edgeCloth,
      })
    }
    // The notch where the lapel's top meets the collar's point, and the snap holding the point down below it.
    const bn = torsoBone(s, lTop)
    decals.push({
      bone: bn,
      at: local(s, bn, [outer(0.02), lTop - 0.004 * k, (frontOf(lapel, outer(0.02), lTop) ?? D) + 0.003]),
      normal: [0, 0, 1],
      material: notch,
    })
    const ts = 0.14
    const ys = lerp(lTop, zipTop, ts)
    const xs = lerp(inner(ts), outer(ts), 0.6)
    const bs = torsoBone(s, ys)
    decals.push({
      bone: bs,
      at: local(s, bs, [xs, ys, (frontOf(lapel, xs, ys) ?? D) + 0.003]),
      normal: [0, 0, 1],
      material: hardware,
    })
  })
  // The asymmetric zip: straight down from the V's foot to the belt, off the centre.
  for (let y = zipTop - 0.004 * k; y > beltTop; y -= 0.004) {
    const u = clamp((zipTop - y) / (zipTop - beltTop), 0, 0.999)
    const bone = torsoBone(s, y)
    decals.push({
      bone,
      at: local(s, bone, [zx, y, (frontOf(sh, zx, y) ?? D) + 0.002]),
      normal: [0.2, 0, 1],
      material: zipAt(zip, u),
    })
  }
  // The belt's free end, through the buckle and on round toward the side, stood off the belt by its own
  // thickness.
  const tx = bx - 0.034 * k
  const slope = ((frontOf(sh, tx + 0.01 * k, by) ?? D) - (frontOf(sh, tx - 0.01 * k, by) ?? D)) / (0.02 * k)
  parts.push(
    piece(J.pelvis, folded, GROUP.torso, SEAM.tab, {
      at: local(s, J.pelvis, [tx, by, (frontOf(sh, tx, by) ?? D) * 1.035 + 0.004 * k]),
      r: [0.026 * k, 0.011 * k, 0.003 * k],
      e: [0.2, 0.3],
      turn: axisAngle([0, 1, 0], -Math.atan(slope)),
      seg: 8,
      rings: 4,
    }),
  )
  // The hardware, in the metal's own tones: the zip teeth its mid, the pulls its light.
  const teeth = tone(made, hardware, 'teeth', 1)
  const pull = tone(made, hardware, 'pull', 0)
  const seam = tone(made, cloth, 'seam', 0)
  // The chest pocket: a zip slanting down and out under the lapel's point on the zip's side, its pull at the
  // top.
  const cp: [number, number] = [zx + 0.018 * k, b.chestY - 0.04 * k]
  const cq: [number, number] = [zx + 0.07 * k, b.chestY - 0.085 * k]
  decals.push(
    ...onShell(s, sh, [cp[0], cp[1] - 0.007 * k], [cq[0], cq[1] - 0.007 * k], notch),
    ...onShell(s, sh, cp, cq, teeth),
  )
  decals.push(
    ...onShell(
      s,
      sh,
      [cp[0] + 0.002 * k, cp[1] - 0.008 * k],
      [cp[0] + 0.002 * k, cp[1] - 0.014 * k],
      pull,
      false,
      0.003,
    ),
  )
  // The hand pockets: a zip each side slanting from high at the side down toward the front, the hand in along
  // it.
  const anchors: Anchor[] = [...hemAnchors(s, sh)]
  for (const [side, x] of SIDES) {
    const y0 = hem + 0.125 * k
    const y1 = hem + 0.055 * k
    const p: [number, number] = [x * widthOf(sh, y0) * 0.9, y0]
    const q: [number, number] = [x * widthOf(sh, y1) * 0.66, y1]
    decals.push(
      ...onShell(s, sh, p, q, teeth),
      ...onShell(
        s,
        sh,
        [p[0] - x * 0.004 * k, p[1] - 0.006 * k],
        [p[0] - x * 0.004 * k, p[1] - 0.012 * k],
        pull,
        false,
        0.003,
      ),
    )
    const ax = (p[0] + q[0]) / 2
    const ay = (p[1] + q[1]) / 2
    anchors.push({
      kind: 'jacketPocket',
      side,
      bone: torsoBone(s, ay),
      at: [ax, ay, frontOf(sh, ax, ay) ?? D],
      open: normalize([-x * 0.5, -0.8, -0.3]),
    })
  }
  // The epaulettes: a strap down each shoulder's line from the collar to the shoulder's point, snapped at the
  // collar end.
  for (const [side, x] of SIDES) {
    const x0 = cR * 1.02
    const x1 = s.genes.shoulders * 0.98
    const xm = (x0 + x1) / 2
    const y0 = topAt(sh, x0)
    const y1 = topAt(sh, x1)
    const ym = topAt(sh, xm)
    const th = 0.004 * k
    parts.push(
      piece(J.chest, folded, GROUP.torso, side === 'L' ? SEAM.epauletteL : SEAM.epauletteR, {
        at: local(s, J.chest, [x * xm, ym + th * 0.6, -0.006 * k]),
        r: [(x1 - x0) / 2, th, 0.017 * k],
        e: [0.25, 0.4],
        turn: axisAngle([0, 0, 1], x * Math.atan((y1 - y0) / (x1 - x0))),
        seg: 10,
        rings: 4,
      }),
    )
    const sx = x0 + 0.014 * k
    decals.push({
      bone: J.chest,
      at: local(s, J.chest, [x * sx, topAt(sh, sx) + th * 2.2, 0.002 * k]),
      normal: normalize([0, 0.5, 0.86]),
      material: pull,
      size: [1, 1],
    })
    // Its front edge folded to the light (as the lapels' are), so the strap reads over the shoulder.
    for (let xx = x0 + 0.02 * k; xx < x1; xx += 0.004)
      decals.push({
        bone: J.chest,
        at: local(s, J.chest, [x * xx, topAt(sh, xx) + th * 1.4, 0.009 * k]),
        normal: normalize([0, 0.4, 0.92]),
        material: edgeCloth,
      })
  }
  // The back: a yoke across the shoulder blades, dipping a little to the middle, and a panel seam either side
  // from it down to the belt, in the hide's light where the leather turns over the seam.
  const yoke = s.shoulderY - 0.07 * k
  const yw = widthOf(sh, yoke) * 0.96
  decals.push(
    ...onShell(s, sh, [-yw, yoke + 0.01 * k], [0, yoke - 0.008 * k], seam, true),
    ...onShell(s, sh, [0, yoke - 0.008 * k], [yw, yoke + 0.01 * k], seam, true),
  )
  for (const [, x] of SIDES)
    decals.push(
      ...onShell(
        s,
        sh,
        [x * widthOf(sh, yoke) * 0.86, yoke],
        [x * widthOf(sh, beltTop) * 0.84, beltTop],
        seam,
        true,
      ),
    )
  // Sleeves: fitted to the arm and narrowing to the cuff, a little ease at the elbow; a zip up the outside of
  // each cuff.
  const sleeveEnd = b.wristY + 0.012 * k
  const sleeveR = (t: number) => lerp(b.arm * 0.95, b.fore * 0.74, t) + 0.004 * k
  parts.push(
    ...sleeves(s, b, cloth, sleeveEnd, sleeveR, {
      rings: 14,
      bump: (t) => 0.05 * Math.exp(-(((t - 0.5) / 0.12) ** 2)),
    }),
  )
  for (const [side, x] of SIDES) {
    const bone = J[`foreArm.${side}`]
    const r = sleeveR(1) + 0.002
    const n: V3 = normalize([x * 0.8, 0, 0.6])
    decals.push(
      ...stroke(
        bone,
        local(s, bone, [x * s.genes.shoulders + n[0] * r, sleeveEnd + 0.002 * k, n[2] * r * 1.04]),
        local(s, bone, [x * s.genes.shoulders + n[0] * r, sleeveEnd + 0.032 * k, n[2] * r * 1.04]),
        n,
        teeth,
      ),
    )
  }
  return { parts, decals, anchors, paint: wholeTop(cloth) }
}

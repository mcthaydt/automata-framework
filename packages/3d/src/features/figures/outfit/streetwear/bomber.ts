// The leather bomber: a blouson gathered into a rib band at the waist, a rib collar standing round the neck,
// rib cuffs, a centre zip closed to the collar, slash pockets, a yoke across the back, a utility zip on the
// left sleeve.
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/streetwear.ts at a1f7246
// (`bomberShell`, `bomber`), with AF's strict types; the formulas and their order are the source's. Cut:
// graphics (SNEKPRTY marks). Changed: painter materials are swatch variants, and the zip's pull, drawn at two
// sizes by density, is one decal at its density-2 size (M3.5b decision 4).

import { clamp, lerp, normalize, smooth, type V3 } from '../../../../shared/math/math.ts'
import type { Measure } from '../../body/genes.ts'
import type { Decal, Part } from '../../body/mesh.ts'
import { J, type Skeleton } from '../../body/rig.ts'
import type { Anchor } from '../../figure/anchors.ts'
import type { Bomber, Garment } from '../../figure/garment.schema.ts'
import { GARMENT_DEFAULTS } from '../../figure/garment-defaults.ts'
import { SIDES } from '../garments/head.ts'
import { over, underneath } from './layering.ts'
import { frontOf, widthOf } from './loft.ts'
import { collar, collarShell, cuffs, hemBand, shellPart, sleeves, torso, type Worn } from './tops.ts'
import {
  type Fit,
  local,
  onShell,
  own,
  SEAM,
  stroke,
  tone,
  torsoBone,
  under,
  type Wearing,
  wholeTop,
  zipAt,
} from './under.ts'

// ─── The bomber ───
interface BomberShell extends Worn {
  top: number
  hem: number
  bandTop: number
  bandBot: number
  D: number
  collarTop: number
  collarBot: number
  collarR: number
}
/**
 * The bomber's body: a blouson, full through the chest and the body and gathered at its foot into a rib band
 * that sits at the waist, so the leather blouses over it; a rib collar standing round the neck.
 */
export function bomberShell(
  m: Measure,
  s: Skeleton,
  item: Bomber,
  garments: readonly Garment[],
): BomberShell {
  const b = under(m, s)
  const { g, k } = b
  const top = s.shoulderY + 0.012 * k
  const waistY = s.hipY + 0.12 * k
  const bandTop = waistY + 0.045 * k
  const bandBot = waistY - 0.014 * k
  const hem = bandTop - 0.008 * k
  const W = g.shoulders * 1.1 + 0.02 * k
  const D = b.depth + 0.042 * k
  // Fullest a little above the band, then drawn in to it over the last fifth (the gather).
  const width = (t: number) =>
    W * (1 + 0.035 * Math.sin(Math.PI * clamp(t / 0.85, 0, 1))) * lerp(1, 0.9, smooth((t - 0.8) / 0.2))
  const depth = (t: number) => D * lerp(1, 0.97, t) * lerp(1, 0.92, smooth((t - 0.82) / 0.18))
  const shell = over(
    m,
    torso(b, top, hem, width, depth, {
      e: 0.8,
      bump: (t, v) => 0.018 * smooth((t - 0.55) / 0.45) * Math.sin(5 * v + 0.9),
    }),
    underneath(m, s, item, garments, bandBot),
  )
  const collarTop = s.shoulderY + 0.048 * k
  const collarBot = s.shoulderY - 0.016 * k
  const collarR = b.neck * 1.42 + 0.012 * k
  return {
    shell,
    cloth: item.bomber,
    top,
    hem,
    bandTop,
    bandBot,
    D,
    neck: b.neck * 1.45 + 0.02 * k,
    collarTop,
    collarBot,
    collarR,
    collar: collarShell(b, collarBot, collarTop, collarR),
    foot: bandBot,
  }
}
export function bomber(w: Wearing, item: Bomber): Fit {
  const { m, s, made } = w
  const b = under(m, s)
  const { k } = b
  const cloth = item.bomber
  const hardware = item.hardware ?? GARMENT_DEFAULTS.bomber.hardware
  const zip = item.zip ?? GARMENT_DEFAULTS.bomber.zip
  const {
    shell: sh,
    hem,
    bandTop,
    bandBot,
    D,
    collarTop,
    collarBot,
    collarR,
  } = bomberShell(m, s, item, w.garments)
  const rib = item.rib ?? own(made, cloth, 'rib')
  const ribs = (_t: number, v: number) => 0.03 * Math.sin(44 * v)
  const parts: Part[] = [shellPart(sh, s, cloth, SEAM.shell, 20)]
  // The band, knit and ribbed, pulled in under the blouson's foot.
  parts.push(hemBand(s, sh, rib, SEAM.hem, bandTop, bandBot, 0.98, ribs))
  // The collar: a rib standing round the neck, closed at the front over the zip's top.
  parts.push(collar(s, b, rib, SEAM.collar, collarBot, collarTop, collarR, ribs))
  // Sleeves: roomy, blousing over the rib cuffs.
  const sleeveTop = b.armY + 0.05 * k
  const cuffTop = b.wristY + 0.052 * k
  const sleeveR = (t: number) =>
    lerp(b.arm * 1.28, b.fore * 1.3, t) * (1 + 0.1 * smooth((t - 0.72) / 0.28)) + 0.005 * k
  parts.push(
    ...sleeves(s, b, cloth, cuffTop, sleeveR, {
      rings: 14,
      bump: (t, v) => 0.04 * smooth((t - 0.35) / 0.4) * Math.sin(3 * v + 5 * t),
    }),
  )
  parts.push(...cuffs(s, b, rib, cuffTop + 0.004 * k, b.wristY + 0.004 * k, b.fore * 1.12, ribs))
  const decals: Decal[] = []
  const seam = tone(made, cloth, 'seam', 0)
  const welt = tone(made, cloth, 'welt', 3)
  const teeth = tone(made, hardware, 'teeth', 1)
  const pull = tone(made, hardware, 'pull', 0)
  // The zip: centre front from the band to the collar's top, its pull at the throat.
  const zipOn = (y: number) =>
    y > collarBot + 0.01 * k
      ? {
          z: 0.008 * k + 0.012 * k * clamp((collarTop - y) / (collarTop - collarBot), 0, 1) + collarR * 0.97,
          bone: J.chest,
        }
      : { z: frontOf(sh, 0, y) ?? D, bone: torsoBone(s, y) }
  for (let y = collarTop - 0.006 * k; y > bandBot + 0.004 * k; y -= 0.004) {
    const u = clamp((collarTop - y) / (collarTop - bandBot), 0, 0.999)
    const { z, bone } = y < bandTop ? { z: (frontOf(sh, 0, hem) ?? D) * 0.98, bone: J.pelvis } : zipOn(y)
    decals.push({ bone, at: local(s, bone, [0, y, z + 0.002]), normal: [0, 0, 1], material: zipAt(zip, u) })
  }
  const py = collarTop - 0.03 * k
  const pz = zipOn(py)
  decals.push({
    bone: pz.bone,
    at: local(s, pz.bone, [0.006 * k, py, pz.z + 0.004]),
    normal: [0, 0, 1],
    material: pull,
    size: [1, 2],
  })
  // A tipping stripe round the collar's top and the band's foot, where the outfit names one.
  if (item.tipping)
    for (const [y, r] of [
      [collarTop - 0.01 * k, collarR * 1.02],
      [bandBot + 0.01 * k, 0],
    ] as const) {
      const sec = r ? null : sh.section(1)
      for (let v = -0.1; v <= Math.PI + 0.1; v += 0.06) {
        const p: V3 = sec
          ? [Math.cos(v) * sec.r[0] * 0.99, y, sec.c[1] + Math.sin(v) * sec.r[1] * 0.99]
          : [Math.cos(v) * r, y, 0.008 * k + Math.sin(v) * r]
        const bone = sec ? J.pelvis : J.chest
        decals.push({
          bone,
          at: local(s, bone, p),
          normal: [Math.cos(v), 0, Math.sin(v)],
          material: item.tipping,
        })
      }
    }
  // The slash pockets: a welt each side slanting down toward the front, its lip catching the light over the
  // opening's shadow; the hand in along it.
  const anchors: Anchor[] = []
  for (const [side, x] of SIDES) {
    const y0 = bandTop + 0.115 * k
    const y1 = bandTop + 0.025 * k
    const p: [number, number] = [x * widthOf(sh, y0) * 0.78, y0]
    const q: [number, number] = [x * widthOf(sh, y1) * 0.56, y1]
    decals.push(
      ...onShell(
        s,
        sh,
        [p[0] - x * 0.004 * k, p[1] + 0.004 * k],
        [q[0] - x * 0.004 * k, q[1] + 0.004 * k],
        seam,
      ),
      ...onShell(s, sh, p, q, welt),
    )
    const ax = (p[0] + q[0]) / 2
    const ay = (p[1] + q[1]) / 2
    anchors.push({
      kind: 'jacketPocket',
      side,
      bone: torsoBone(s, ay),
      at: [ax, ay, frontOf(sh, ax, ay) ?? D],
      open: normalize([-x * 0.55, -0.75, -0.3]),
    })
    anchors.push({
      kind: 'hem',
      side,
      bone: J.pelvis,
      at: [x * widthOf(sh, hem) * 0.9, bandBot + 0.004 * k, 0.25 * (frontOf(sh, 0, hem) ?? 0)],
      open: [0, 1, 0],
    })
  }
  // The back: a yoke across the shoulder blades, in the hide's light where the leather turns over the seam.
  const yoke = s.shoulderY - 0.075 * k
  const yw = widthOf(sh, yoke) * 0.97
  decals.push(...onShell(s, sh, [-yw, yoke], [yw, yoke], seam, true))
  // The sleeve's utility pocket: a small zip down the outside of the wearer's left upper arm.
  const bone = J['upperArm.L']
  const ut = 0.22
  const uy = lerp(sleeveTop, cuffTop, ut)
  const ur = sleeveR(ut) * 1.03
  const n: V3 = normalize([0.75, 0, 0.66])
  decals.push(
    ...stroke(
      bone,
      local(s, bone, [s.genes.shoulders + n[0] * ur, uy, n[2] * ur]),
      local(s, bone, [s.genes.shoulders + n[0] * ur, uy - 0.05 * k, n[2] * ur]),
      n,
      teeth,
    ),
  )
  return { parts, decals, anchors, paint: wholeTop(cloth) }
}

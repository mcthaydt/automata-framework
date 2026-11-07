// Shoes, jewellery and eyewear: chunky sneakers (a two-tone sole, a padded collar, a mudguard, laces), a
// chain round the neck lying on the outermost top, hoops from the lobes, and wraparound shades (on the face,
// or pushed up onto the hair or a cap).
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/streetwear.ts at a1f7246
// (`sneakers`, `chain`, `hoops`, `faceSection`, `shades`, `shadesUp`), with AF's strict types; the formulas
// and their order are the source's. Cut: the chain's nameplate (its print, its plate, its `pendant` anchor
// and the drop that grows to keep it on one cloth: SNEKPRTY), the shadow marks the painter lays under the
// chain, and the sheets' camera pitch. Changed: painter materials are swatch variants; marks drawn per
// density are drawn once, at density 2 (the fixed ppm's; M3.5b decision 4), so the chain's rope is two texels
// wide.

import {
  add,
  axisAngle,
  clamp,
  cross,
  lerp,
  normalize,
  scale,
  smooth,
  sub,
  type V3,
} from '../../../../shared/math/math.ts'
import type { Measure } from '../../body/genes.ts'
import { type Decal, GROUP, type Part, placed } from '../../body/mesh.ts'
import { reach } from '../../body/reach.ts'
import { at, J, type Side, type Skeleton } from '../../body/rig.ts'
import { superquadric } from '../../body/superquadric.ts'
import { FIGURE_PPM } from '../../body/texels.ts'
import type { Chain, Hoops, Shades, Sneakers } from '../../figure/garment.schema.ts'
import { GARMENT_DEFAULTS } from '../../figure/garment-defaults.ts'
import { variant } from '../../figure/materials.ts'
import { CROWN, onSkull, skull, toHead } from '../../hair/skull.ts'
import { GARMENTS, garmentOf } from '../../registry/garment-registry.ts'
import { ear, headForm, SIDES } from '../garments/head.ts'
import { frontOf, loft, type Section, torus } from './loft.ts'
import { tops } from './tops.ts'
import { type Fit, FRONT, local, piece, SEAM, stroke, under, type Wearing } from './under.ts'

// ─── Shoes ───
export function sneakers(w: Wearing, item: Sneakers): Fit {
  const { m, s } = w
  const b = under(m, s)
  const { g, k } = b
  const fw = m.foot
  const upper = item.sneakers
  const sole = item.sole ?? GARMENT_DEFAULTS.sneakers.sole
  const outsole = item.outsole ?? GARMENT_DEFAULTS.sneakers.outsole
  const guard = item.mudguard ?? upper
  const floor = -g.ankle
  const heel = -0.32 * g.foot
  const toe = 0.9 * g.foot
  const W = 0.062 * k * fw
  const H = 0.05 * k
  // A footprint rounded at the toe and the heel. A runner's toe springs up off the floor and its sole thins
  // to it; a court shoe's cupsole stays flat and thick all along.
  const plan = (t: number) =>
    (1 - Math.abs(2 * t - 1) ** 3.5) ** (1 / 3.5) * lerp(0.92, 1, Math.sin(Math.PI * t))
  const spring = (t: number) => (item.court ? 0 : 0.028 * k * smooth((t - 0.72) / 0.28) ** 1.6)
  const soleH = (t: number) => (item.court ? H * 0.84 : lerp(H, H * 0.72, t))
  const parts: Part[] = []
  const decals: Decal[] = []
  const group = (side: Side) => (side === 'L' ? GROUP.legL : GROUP.legR)
  const z = (t: number) => lerp(heel, toe, t)
  const soleTop = (t: number) => floor + spring(t) + soleH(t)
  // The upper's top line: high at the heel's collar, down over the instep to a low, round toe box.
  const upperTop = (t: number) =>
    soleTop(t) +
    (item.court ? lerp(0.09, 0.04, smooth((t - 0.25) / 0.55)) : lerp(0.1, 0.048, smooth((t - 0.22) / 0.6))) *
      k
  for (const [side] of SIDES) {
    const foot = J[`foot.${side}`]
    const lg = group(side)
    // The outsole: a dark tread band under the midsole, its own seam so the two read as two tones.
    parts.push({
      bone: foot,
      material: outsole,
      group: lg,
      seam: SEAM.outsole,
      mesh: loft(
        'z',
        heel,
        toe,
        (t) => {
          const lo = floor + spring(t)
          return { c: [0, lo + 0.009 * k], r: [W * plan(t) + 0.002, 0.0095 * k], e: 0.5 }
        },
        { rings: 14, seg: 12 },
      ),
    })
    // The midsole: thick, deepest at the heel, flared wider than the upper.
    parts.push({
      bone: foot,
      material: sole,
      group: lg,
      seam: SEAM.sole,
      mesh: loft(
        'z',
        heel + 0.004,
        toe - 0.004,
        (t) => {
          const lo = floor + spring(t) + 0.014 * k
          const hi = soleTop(t)
          return { c: [0, (lo + hi) / 2], r: [W * plan(t), (hi - lo) / 2], e: 0.45 }
        },
        { rings: 14, seg: 14 },
      ),
    })
    // The upper: a bulbous toe box rising to the padded collar at the ankle, a little inside the midsole's
    // edge.
    parts.push({
      bone: foot,
      material: upper,
      group: lg,
      seam: SEAM.upper,
      mesh: loft(
        'z',
        heel + 0.012,
        toe - 0.012,
        (t) => {
          const lo = soleTop(t) - 0.012 * k
          const hi = upperTop(t)
          return { c: [0, (lo + hi) / 2], r: [W * 0.9 * plan(t), (hi - lo) / 2], e: 0.62 }
        },
        { rings: 16, seg: 16 },
      ),
    })
    const collarAt: V3 = [0, upperTop(0.14) - 0.004 * k, z(0.17)]
    const collarR: V3 = [W * 0.84, 0.024 * k, 0.075 * k]
    parts.push(
      piece(foot, upper, lg, SEAM.upper, { at: collarAt, r: collarR, e: [0.6, 0.8], seg: 14, rings: 6 }),
    )
    parts.push(
      piece(foot, upper, lg, SEAM.upper, {
        at: [0, upperTop(0.32) + 0.006 * k, z(0.32)],
        r: [W * 0.42, 0.028 * k, 0.016 * k],
        e: [0.5, 0.6],
        turn: axisAngle([1, 0, 0], 0.45),
        seg: 10,
        rings: 5,
      }),
    )
    // The mudguard: a band wrapping the upper's foot from toe to heel, high round the toe cap and the heel
    // counter.
    if (guard !== upper)
      parts.push({
        bone: foot,
        material: guard,
        group: lg,
        seam: SEAM.mudguard,
        mesh: loft(
          'z',
          heel + 0.008,
          toe - 0.008,
          (t) => {
            const lo = soleTop(t) - 0.01 * k
            const hi = soleTop(t) + (0.013 + (item.court ? 0.004 : 0.02 * (2 * t - 1) ** 2)) * k
            return { c: [0, (lo + hi) / 2], r: [W * 0.9 * plan(t) + 0.003, (hi - lo) / 2], e: 0.5 }
          },
          { rings: 16, seg: 16 },
        ),
      })
    // The heel tab, only where the trousers' hems clear the collar: under a stacked hem it would show
    // through.
    const collarTop = g.ankle + collarAt[1] + collarR[1]
    const covered = w.garments.some((o) => {
      const c = garmentOf(o)
      const cut = c ? GARMENTS[c]?.cut : undefined
      return !!cut && cut(m, s, o).hem < collarTop
    })
    if (item.tab && !covered)
      parts.push(
        piece(foot, item.tab, lg, SEAM.heelTab, {
          at: [0, collarAt[1] + 0.008 * k, collarAt[2] - collarR[2] * 0.96],
          r: [W * 0.28, 0.02 * k, 0.006 * k],
          e: [0.4, 0.5],
          seg: 8,
          rings: 4,
        }),
      )
    // Laces: three bars across the vamp.
    if (item.laces)
      for (let i = 0; i < 3; i++) {
        const t = lerp(0.38, 0.58, i / 2)
        const y = upperTop(t) + 0.004 * k
        decals.push(...stroke(foot, [-W * 0.28, y, z(t)], [W * 0.28, y, z(t)], [0, 0.8, 0.6], item.laces))
      }
  }
  return { parts, decals, paint: { shoe: upper, sole } }
}

// ─── The chain ───
/**
 * A rope of links round the neck, laid on the outermost cloth (and over any collar standing there) from the
 * neck's sides to a U on the chest, round the nape behind: its links as long as it is wide, the metal's lit
 * and mid tones by turns, each row a link on from the last so they twist, a glint every fourth link on the
 * key's side.
 */
export function chain(w: Wearing, item: Chain): Fit {
  const { m, s, made } = w
  const b = under(m, s)
  const { k } = b
  const { shells, neck } = tops(m, s, b, w.garments)
  /** The outermost surface at (x, y). */
  const onTop = (x: number, y: number) => {
    let z = b.depth
    for (const { shell, collar } of shells)
      for (const sh of collar ? [shell, collar] : [shell]) {
        if (sh.open?.(x, y)) continue
        const f = frontOf(sh, x, y)
        if (f !== null && f > z) z = f
      }
    return z
  }
  const glint = variant(made, item.chain, 'glint', { flat: true, shade: 1 })
  const light = variant(made, item.chain, 'light', { flat: true })
  const mid = variant(made, item.links ?? GARMENT_DEFAULTS.chain.links, 'link', { flat: true })
  // The rope at the fixed ppm: 0.025 m wide at 1.62 m, in whole texels.
  const texel = 1 / FIGURE_PPM
  const rows = Math.max(1, Math.round((0.025 * k) / texel))
  const link = rows * texel
  // The path: from the neck's sides down to a V on the chest (a little round at its foot); behind, on the
  // nape.
  const yTop = s.shoulderY + 0.004 * k
  const xn = neck + 0.006 * k
  const drop = (item.drop ?? 0.13) * k
  const yAt = (u: number) => yTop - drop * (1 - Math.abs(u) ** 1.2)
  const path: { x: number; y: number; z?: number; out: [number, number]; n: V3 }[] = []
  for (let i = 0; i <= 400; i++) {
    const u = -1 + (2 * i) / 400
    const x = xn * Math.sin((u * Math.PI) / 2)
    const du = 1e-3
    const tx = xn * Math.sin(((u + du) * Math.PI) / 2) - x
    const ty = yAt(u + du) - yAt(u)
    const l = Math.hypot(tx, ty) || 1
    path.push({
      x,
      y: yAt(u),
      out: (ty / l) * Math.sign(-tx || 1) > 0 ? [ty / l, -tx / l] : [-ty / l, tx / l],
      n: normalize([x * 0.6, 0.2, 1]),
    })
  }
  for (let i = 1; i < 80; i++) {
    const a = (Math.PI * i) / 80
    const R = lerp(xn, b.neck * 1.15, Math.sin(a))
    path.push({
      x: R * Math.cos(a),
      y: yTop + 0.006 * k,
      z: 0.01 * k - R * Math.sin(a) * 0.9,
      out: [0, -1],
      n: normalize([Math.cos(a), 0.3, -Math.sin(a)]),
    })
  }
  const decals: Decal[] = []
  const run: number[] = [0]
  for (let i = 1; i < path.length; i++) {
    const p = at(path, i)
    const q = at(path, i - 1)
    run.push(at(run, i - 1) + Math.hypot(p.x - q.x, p.y - q.y, (p.z ?? 0) - (q.z ?? 0)))
  }
  for (let r = rows - 1; r >= 0; r--)
    path.forEach((p, i) => {
      const n = Math.floor((at(run, i) + r * texel) / link)
      const key = p.x < 0 && p.z === undefined && n % 4 === 1
      const x = p.x + p.out[0] * r * texel
      const y = p.y + p.out[1] * r * texel
      const z = p.z ?? onTop(x, y) + 0.004 * k
      decals.push({
        bone: J.chest,
        at: local(s, J.chest, [x, y, z]),
        normal: p.n,
        material: key ? glint : rows > 1 && (n + r) % 2 ? mid : light,
      })
    })
  return { parts: [], decals }
}

// ─── Hoops ───
/** Hoops from the lobes: a ring beside the jaw, turned toward the front a little so it reads as a ring from
 * there as well as the side, polished. A huggie (under 0.12 of the head) is a stud at the lobe. */
export function hoops(w: Wearing, item: Hoops): Fit {
  const { m, s, made } = w
  const k = m.k
  const size = item.size ?? 0.3
  const tube = Math.min(0.0055 * k, size * s.genes.head * 0.12)
  const R = (size * s.genes.head) / 2 - tube
  // From the ear's own lobe, the ring's tube just outside it.
  const lobe = (x: number): V3 => add(ear(m, s, x).lobe, [x * tube, 0, 0])
  if (size < 0.12)
    return {
      parts: [],
      decals: SIDES.map(([, x]) => ({
        bone: J.head,
        at: lobe(x),
        normal: normalize([x, -0.2, 0.6]),
        material: item.hoops,
      })),
    }
  const metal = variant(made, item.hoops, 'hoop', { gloss: 0.85 })
  return {
    parts: SIDES.map(([, x]) => ({
      bone: J.head,
      material: metal,
      group: GROUP.head,
      seam: SEAM.hoop,
      mesh: placed(
        torus(R, tube, 28, 6),
        sub(lobe(x), [0, R, 0]),
        axisAngle([0, 1, 0], x * (Math.PI / 2 - 0.95)),
      ),
    })),
  }
}

// ─── Shades ───
/**
 * The head's section round its face at height t (0 the chin, 1 the crown), on its own form, `off` out from
 * it.
 */
function faceSection(m: Measure, s: Skeleton, t: number, off: number): Section {
  const f = headForm(m, s)
  const front = f.front(t)
  const back = f.back(t)
  return {
    c: [0, (front + back) / 2],
    r: [f.width(t) + off, (front - back) / 2 + off],
    e: lerp(lerp(1.3, 0.88, smooth((t - 0.32) / 0.1)), 1, smooth((t - 0.7) / 0.24)),
  }
}
/**
 * Wraparound shades. On the face: a shield lens wrapped to the head's own section at the eye row, across both
 * eyes and round to the temples, notched up over the nose, a thin frame along its top running back as the
 * arms. `up`: pushed back onto the head.
 */
export function shades(w: Wearing, item: Shades): Fit {
  const { m, s } = w
  const g = s.genes
  const k = m.k
  const h = g.head
  const frame = item.frame ?? GARMENT_DEFAULTS.shades.frame
  if (item.up)
    return shadesUp(
      w,
      item,
      w.worn.filter((p) => p.group === GROUP.hair),
    )
  const t0 = 0.535
  const t1 = 0.4
  const wrap = 1.25
  const off = 0.012 * k
  const lens = loft('y', h * t0, h * t1, (t) => faceSection(m, s, lerp(t0, t1, t), off * lerp(1, 0.9, t)), {
    rings: 6,
    seg: 24,
    arc: () => [FRONT - wrap, FRONT + wrap],
    shift: (t, v) =>
      t * (0.06 * h * Math.exp(-(((v - FRONT) / 0.2) ** 2)) + (0.035 * h * Math.abs(v - FRONT)) / wrap),
  })
  // The frame: a thin bar along the lens's top, running back as the arms to above the ears; a line of it down
  // the bridge of the nose, parting the shield into its two eyes.
  const top = h * t0
  const bar = loft(
    'y',
    top + 0.006 * k,
    top - 0.004 * k,
    (t) => faceSection(m, s, lerp(t0 + 0.02, t0, t), off + 0.003 * k),
    {
      rings: 1,
      seg: 32,
      arc: () => [FRONT - wrap - 1.0, FRONT + wrap + 1.0],
    },
  )
  const front = (t: number) => {
    const sec = faceSection(m, s, t, off)
    return sec.c[1] + sec.r[1] + 0.002 * k
  }
  const decals = stroke(
    J.head,
    [0, top - 0.004 * k, front(t0)],
    [0, (h * (t0 + t1)) / 2 - 0.01 * k, front((t0 + t1) / 2) + 0.004 * k],
    [0, 0, 1],
    frame,
  )
  return {
    parts: [
      { bone: J.head, material: item.shades, group: GROUP.head, seam: SEAM.lens, mesh: lens },
      { bone: J.head, material: frame, group: GROUP.head, seam: SEAM.frame, mesh: bar },
    ],
    decals,
  }
}
/**
 * Shades pushed up onto the head: two lenses and the bridge between them lying over the crown's front on
 * whatever is outermost there (the hair's top over the crown, a cap; else the skull), each lens rimmed by its
 * frame and the arms running back from their outer edges toward the ears. Tinted dark, so they sit under the
 * face in value; one glint.
 */
function shadesUp(w: Wearing, item: Shades, headParts: readonly Part[]): Fit {
  const { m, s, made } = w
  const k = m.k
  const sk = skull(s)
  const form = headForm(m, s)
  const frame = item.frame ?? GARMENT_DEFAULTS.shades.frame
  const base = at(s.rest, J.head)
  const origin = add(base, sk.c)
  const tint = variant(made, item.shades, 'up', { matte: true, shade: -1 })
  const rim = variant(made, frame, 'up', { matte: true, shade: -1 })
  const glint = variant(made, item.shades, 'glint', { flat: true, shade: 1 })
  // On the hair's top over the crown, never on a lock, a fringe or a tail standing off it.
  const crown = headParts.filter((p) => p.tag === CROWN)
  const on = crown.length ? crown : headParts
  // A point on the outermost surface at angle `a` round from the front, `y` up the skull, and the way out
  // there.
  const surface = (a: number, y: number, off: number): { p: V3; n: V3 } => {
    const d = normalize(sub(onSkull(sk, a, y), sk.c))
    const r = reach(on, s.rest, origin, d)
    const point =
      r > 0 ? add(origin, scale(d, r + off)) : add(toHead(form, sk, d, 0.04), add(base, scale(d, off)))
    return { p: sub(point, base), n: d }
  }
  // Over the crown's front, above the hairline: the lenses face up and forward there.
  const Y = 0.84
  const apart = 0.34
  const parts: Part[] = []
  const lay = (a: number, material: string, seam: number, r: V3, off: number) => {
    const { p, n } = surface(a, Y, off)
    const axis = cross([0, 0, 1], n)
    const turn = axisAngle(
      normalize(Math.hypot(...axis) > 1e-6 ? axis : [1, 0, 0]),
      Math.acos(clamp(n[2], -1, 1)),
    )
    parts.push({
      bone: J.head,
      material,
      group: GROUP.head,
      seam,
      mesh: superquadric({ at: p, r, e: [0.45, 0.5], seg: 12, rings: 6, turn }),
    })
    return { p, n }
  }
  const decals: Decal[] = []
  for (const [, x] of SIDES) {
    lay(x * apart, rim, SEAM.frame, [0.028 * k, 0.021 * k, 0.003 * k], 0.006 * k)
    const { p, n } = lay(x * apart, tint, SEAM.lens, [0.021 * k, 0.015 * k, 0.003 * k], 0.009 * k)
    if (x < 0)
      decals.push({ bone: J.head, at: add(p, [-0.01 * k, 0.006 * k, 0.004 * k]), normal: n, material: glint })
    // The arm: from the lens's outer edge back round the head, dropping a little toward the ear.
    for (let a = apart + 0.55; a < apart + 1.25; a += 0.04) {
      const q = surface(x * a, Y - (a - apart) * 0.3, 0.004 * k)
      decals.push({ bone: J.head, at: q.p, normal: q.n, material: rim })
    }
  }
  lay(0, rim, SEAM.frame, [0.012 * k, 0.005 * k, 0.003 * k], 0.006 * k)
  return { parts, decals }
}

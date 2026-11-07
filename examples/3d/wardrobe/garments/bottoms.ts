// The bottoms: trousers (a seat and a waistband on the pelvis, a leg down each side, their construction
// marked on whichever of them is outermost), wide-leg denim with a stacked break over the shoe, and cargos
// (wide and straight with bellows pockets, or cuffed at the ankle). A wide leg's hem rides its hem pivot
// (J.hemL / J.hemR).
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/streetwear.ts at a1f7246
// (`trousers`, `stacked`, `breakOver`, `wideCut`, `wideLegs`, `cargoCut`, `cargos`), with AF's strict types;
// the formulas and their order are the source's. Cut: the wash (the wide-legs' `fade`, a painter stain).
// Changed: painter materials are swatch variants; the stitching, which the source draws tonal at density 2
// and in the outfit's thread from density 3, is drawn once, in the thread when the outfit names one, and a
// back pocket is its top edge (M3.5b decision 4).

import type { Anchor, Garment, Measure } from '@automata/3d/figures-kit'
import {
  at,
  clamp,
  type Decal,
  GROUP,
  J,
  lerp,
  normalize,
  type Part,
  SIDES,
  type Side,
  type Skeleton,
  sgnPow,
  smooth,
  superquadric,
  type V3,
  variant,
  type Weight,
} from '@automata/3d/figures-kit'
import { WARDROBE_DEFAULTS } from './defaults.ts'
import type { Cargos, WideLegs } from './garment-types.ts'
import { bandOf, fitLegs, type Legs, legAt, legSection, seatOf, sliceOf } from './layering.ts'
import { type Loft, loft, quadricZ, type Section, sectionZ, widthOf } from './loft.ts'
import { topOf, type Worn } from './tops.ts'
import {
  drapeSkin,
  type Fit,
  FRONT,
  legSkin,
  local,
  own,
  SEAM,
  skinned,
  tone,
  under,
  type Wearing,
} from './under.ts'

interface TrouserOptions {
  bump?: Loft['bump']
  shift?: Loft['shift']
  rings?: number
  skin?: (side: Side) => (x: number, y: number) => Weight[]
  stitch?: string | undefined
  hardware?: string | undefined
  garments?: readonly Garment[]
}
interface Trousers {
  parts: Part[]
  section: (x: number, t: number) => Section
  legTop: number
  decals: Decal[]
  anchors: Anchor[]
}

/** The trousers' seat and waistband, and a leg each down `legs`; `skin` how a leg rides the rig. Returns the
 * parts and each leg's section at t (for a pocket on it). */
function trousers(w: Wearing, cloth: string, legs: Legs, o: TrouserOptions = {}): Trousers {
  const { m, s, made } = w
  const b = under(m, s)
  const { k } = b
  const waistY = s.hipY + 0.12 * k
  const { top: legTop, hem } = legs
  const seat = seatOf(b, k, legs)
  // The waistband a tone lighter (it turns over the top, catching the key), so it reads as its own band over
  // the seat.
  const band = variant(made, cloth, 'band', { shade: 1 })
  const parts: Part[] = [
    // The seat, in rest figure space on the pelvis.
    skinned(superquadric({ ...seat, seg: 18, rings: 8 }), cloth, GROUP.torso, SEAM.seat, () => [
      [J.pelvis, 1],
    ]),
    // The waistband round the waist, flaring a little toward the seat below it.
    skinned(
      loft('y', waistY + 0.016 * k, waistY - 0.016 * k, bandOf(b, k), { rings: 2, seg: 24 }),
      band,
      GROUP.torso,
      SEAM.waistband,
      () => [[J.pelvis, 1]],
    ),
  ]
  const section = legSection(k, legs)
  for (const [side, x] of SIDES)
    parts.push(
      skinned(
        loft('y', legTop, hem, (t) => section(x, t), {
          rings: o.rings ?? 18,
          seg: 18,
          bump: o.bump,
          shift: o.shift,
        }),
        cloth,
        side === 'L' ? GROUP.legL : GROUP.legR,
        side === 'L' ? SEAM.legL : SEAM.legR,
        (o.skin ?? ((sd) => legSkin(s, sd, k)))(side),
      ),
    )
  // The construction, drawn on whichever of the band, the seat and the legs is outermost at each point: the
  // stitching in the outfit's thread (the cloth's own light when it names none), the openings in the cloth's
  // deepest, the button in the hardware's light.
  const stitch = o.stitch ? tone(made, o.stitch, 'thread', 1) : own(made, cloth, 'stitch')
  const open = tone(made, cloth, 'open', 3)
  const button = tone(made, o.hardware ?? WARDROBE_DEFAULTS.wideLegs.hardware, 'button', 0)
  const surface = (x: number, y: number, back: boolean): { z: number; bone: number } | null => {
    const d = back ? -1 : 1
    const found: { z: number; bone: number }[] = []
    const take = (z: number | null, bone: number) => {
      if (z !== null) found.push({ z, bone })
    }
    const wb = (waistY + 0.016 * k - y) / (0.032 * k)
    if (wb >= 0 && wb <= 1) take(sectionZ(bandOf(b, k)(wb), x, back), J.pelvis)
    take(quadricZ(seat, x, y, back), J.pelvis)
    const t = (legTop - y) / (legTop - hem)
    if (t >= 0 && t <= 1)
      for (const [side, sx] of SIDES) take(sectionZ(section(sx, t), x, back), J[`thigh.${side}`])
    return found.sort((p, q) => d * (q.z - p.z))[0] ?? null
  }
  // Marks only where no top worn over the trousers hangs (a tall tee, a hoodie).
  const coats = (o.garments ?? [])
    .map((g) => topOf(m, s, g, o.garments ?? []))
    .filter((worn): worn is Worn => !!worn)
  const hidden = (x: number, y: number) =>
    coats.some(
      ({ shell: sh, foot }) =>
        y <= sh.from &&
        y >= Math.min(sh.to, foot ?? sh.to) - 0.006 * k &&
        Math.abs(x) <= widthOf(sh, clamp(y, sh.to, sh.from)) + 0.006 * k,
    )
  const decals: Decal[] = []
  const hw = seat.r[0]
  const line = (pts: [number, number][], material: string, back = false) => {
    const d = back ? -1 : 1
    for (let i = 1; i < pts.length; i++) {
      const a = at(pts, i - 1)
      const c = at(pts, i)
      const n = Math.max(1, Math.ceil(Math.hypot(c[0] - a[0], c[1] - a[1]) / 0.004))
      for (let j = i === 1 ? 0 : 1; j <= n; j++) {
        const x = lerp(a[0], c[0], j / n)
        const y = lerp(a[1], c[1], j / n)
        const on = surface(x, y, back)
        if (!on || hidden(x, y)) continue
        decals.push({
          bone: on.bone,
          at: local(s, on.bone, [x, y, on.z + d * 0.002]),
          normal: normalize([clamp(x / hw, -1, 1) * 0.8, 0, d]),
          material,
        })
      }
    }
  }
  const curve = (f: (u: number) => [number, number], n = 12) =>
    Array.from({ length: n + 1 }, (_, i) => f(i / n))
  const bandFoot = waistY - 0.016 * k
  const sideAt = (y: number) => {
    const sl = sliceOf(seat, y, 0)
    return sl.length ? Math.max(...sl.map((p) => p[0])) : hw
  }
  // The button at the band's middle, and the fly's J stitched down from it on the wearer's left, curving in
  // at its foot.
  const bz = sectionZ(bandOf(b, k)(0.5), 0) ?? b.waistDepth
  if (!hidden(0, waistY))
    decals.push({
      bone: J.pelvis,
      at: local(s, J.pelvis, [0, waistY, bz + 0.003]),
      normal: [0, 0, 1],
      material: button,
    })
  const flyFoot = s.hipY + 0.01 * k
  line(
    curve((u) => [
      0.024 * k * (u < 0.75 ? 1 : Math.cos((((u - 0.75) / 0.25) * Math.PI) / 2)),
      lerp(
        bandFoot,
        flyFoot,
        u < 0.75 ? (u / 0.75) * 0.8 : 0.8 + 0.2 * Math.sin((((u - 0.75) / 0.25) * Math.PI) / 2),
      ),
    ]),
    stitch,
  )
  // The scoop pockets: from the band down and round to the side seam, the hand in where the scoop turns down
  // to the side seam, down and a little back.
  const anchors: Anchor[] = []
  const scoopFoot = bandFoot - 0.075 * k
  for (const [side, x] of SIDES) {
    const x0 = 0.06 * k
    const x1 = sideAt(scoopFoot) * 0.96
    const scoop = (u: number): [number, number] => [
      x * (x1 - (x1 - x0) * Math.cos((u * Math.PI) / 2)),
      bandFoot - (bandFoot - scoopFoot) * Math.sin((u * Math.PI) / 2),
    ]
    line(curve(scoop), open)
    const [ax, ay] = scoop(0.75)
    const on = surface(ax, ay, false)
    if (on)
      anchors.push({
        kind: 'frontPocket',
        side,
        bone: J.pelvis,
        at: [ax, ay, on.z],
        open: normalize([x * 0.15, -0.95, -0.2]),
      })
    anchors.push({
      kind: 'hip',
      side,
      bone: J.pelvis,
      at: [x * sideAt(bandFoot - 0.03 * k), bandFoot - 0.03 * k, 0],
      open: [-x, 0, 0],
    })
  }
  // The back: a yoke dipping to the middle, and a patch pocket each side below it, its top edge stitched.
  const yokeSide = bandFoot - 0.035 * k
  const yokeMid = bandFoot - 0.065 * k
  line(
    [
      [-sideAt(yokeSide) * 0.97, yokeSide],
      [0, yokeMid],
      [sideAt(yokeSide) * 0.97, yokeSide],
    ],
    stitch,
    true,
  )
  for (const [, x] of SIDES) {
    const top = yokeMid - 0.014 * k
    const cx = x * sideAt(top) * 0.48
    const pw = 0.042 * k
    line(
      [
        [cx - pw, top],
        [cx + pw, top],
      ],
      stitch,
      true,
    )
  }
  // The inseam: a crease down the inside of each thigh from the crotch, where the legs part.
  for (const [side, x] of SIDES) {
    const thigh = J[`thigh.${side}`]
    const v = FRONT + x * 0.75
    for (let t = 0.1; t <= 0.42; t += 0.01) {
      const sec = section(x, t)
      const e = sec.e ?? 1
      const y = lerp(legTop, hem, t)
      if (y > seat.at[1] - seat.r[1] * 0.85 || hidden(sec.c[0], y)) continue
      const p: V3 = [
        sec.c[0] + sgnPow(Math.cos(v), e) * sec.r[0] * 1.01,
        y,
        sec.c[1] + sgnPow(Math.sin(v), e) * sec.r[1] * 1.01,
      ]
      decals.push({
        bone: thigh,
        at: local(s, thigh, p),
        normal: normalize([Math.cos(v), 0, Math.sin(v)]),
        material: open,
      })
    }
  }
  return { parts, section, legTop, decals, anchors }
}

/**
 * The stacked break: the last `from` of the leg rumpled in soft rings over the shoe, never quite level,
 * `depth` deep.
 */
const stacked =
  (from: number, depth: number) =>
  (t: number, v: number): number => {
    const u = smooth((t - (1 - from)) / from)
    return u * (depth * Math.sin((Math.PI * 3.2 * (t - (1 - from))) / from + 1.6 * Math.sin(v + 0.7)) + 0.03)
  }
/**
 * The hem rides up over the instep at the front, and a little at the heel, so a texel or two of the sole
 * shows behind.
 */
const breakOver =
  (k: number, front: number, back: number) =>
  (t: number, v: number): number =>
    t > 0.9
      ? (Math.max(0, Math.sin(v)) ** 2 * front * smooth((t - 0.96) / 0.04) +
          Math.max(0, -Math.sin(v)) ** 1.5 * back * smooth((t - 0.9) / 0.1)) *
        k
      : 0

/** The wide-legs' cut: fitted over the hip, wide from mid-thigh down, a touch wider again at the hem. */
export function wideCut(m: Measure, s: Skeleton): Legs {
  const b = under(m, s)
  const { k } = b
  return fitLegs(b, {
    top: s.hipY + 0.06 * k,
    hem: 0.014 * k,
    folds: 0.1,
    radius: (t) =>
      lerp(b.thigh * 0.98, b.thigh * 1.1 + 0.008 * k, smooth((t - 0.2) / 0.45)) *
      lerp(1, 1.05, smooth((t - 0.6) / 0.4)),
  })
}
export function wideLegs(w: Wearing, item: WideLegs): Fit {
  const { m, s } = w
  const { k } = m
  const cloth = item.wideLegs
  const made = trousers(w, cloth, wideCut(m, s), {
    bump: stacked(0.24, 0.07),
    shift: breakOver(k, 0.06, 0.06),
    rings: 26,
    skin: (side) => drapeSkin(s, side, k),
    stitch: item.stitch,
    hardware: item.hardware,
    garments: w.garments,
  })
  return {
    parts: made.parts,
    decals: made.decals,
    anchors: made.anchors,
    paint: { pelvis: cloth, thigh: cloth, knee: cloth, shin: cloth },
  }
}
/** The cargos' cut: easy over the hip, wide and straight from the upper thigh to a stacked hem (`width` of
 * the era's); or, cuffed, relaxed through the thigh and blousing over a gathered ankle. */
export function cargoCut(m: Measure, s: Skeleton, item: Cargos): Legs {
  const b = under(m, s)
  const { k } = b
  const w = item.width ?? 1
  const cuffTop = s.genes.ankle + 0.085 * k
  const straight = (b.thigh * 1.02 + 0.012 * k) * w
  return fitLegs(b, {
    top: s.hipY + 0.06 * k,
    hem: item.cuff ? cuffTop : 0.02 * k,
    folds: item.cuff ? 0.05 : 0.11,
    radius: item.cuff
      ? (t: number) => {
          const thigh = b.thigh * 1.08 + 0.01 * k
          const knee = b.thigh * 0.98 + 0.008 * k
          const blouse = b.shin * 1.42 + 0.008 * k
          const ankle = b.shin * 1.12
          return t < 0.45
            ? lerp(thigh, knee, smooth(t / 0.45))
            : t < 0.86
              ? lerp(knee, blouse, smooth((t - 0.45) / 0.41))
              : lerp(blouse, ankle, smooth((t - 0.86) / 0.14))
        }
      : (t: number) =>
          lerp(b.thigh * 1.0 + 0.006 * k, straight, smooth(t / 0.35)) *
          lerp(1, 1.04, smooth((t - 0.7) / 0.3)),
  })
}
export function cargos(w: Wearing, item: Cargos): Fit {
  const { m, s, made } = w
  const { k } = m
  const cloth = item.cargos
  const hardware = item.hardware ?? WARDROBE_DEFAULTS.cargos.hardware
  const cut = cargoCut(m, s, item)
  const { hem, radius } = cut
  const cuffTop = s.genes.ankle + 0.085 * k
  const { parts, section, legTop, decals, anchors } = item.cuff
    ? trousers(w, cloth, cut, {
        bump: (t, v) => 0.05 * smooth((t - 0.6) / 0.3) * Math.sin(3 * v + 4 * t),
        rings: 20,
        stitch: item.stitch,
        hardware,
        garments: w.garments,
      })
    : trousers(w, cloth, cut, {
        bump: (t, v) => stacked(0.18, 0.05)(t, v) + 0.03 * smooth((t - 0.3) / 0.4) * Math.sin(3 * v + 3 * t),
        shift: breakOver(k, 0.055, 0.03),
        rings: 24,
        skin: (side) => drapeSkin(s, side, k),
        stitch: item.stitch,
        hardware,
        garments: w.garments,
      })
  const flapCloth = variant(made, cloth, 'flap', { shade: 1 })
  const creaseCloth = tone(made, cloth, 'crease', 3)
  if (item.cuff) {
    // The cuffs at the ankle, gathered over the sneakers' collars, ribbed, a bungee's toggle at each one's
    // outer side.
    const ankle = radius(1)
    for (const [side, x] of SIDES) {
      parts.push(
        skinned(
          loft(
            'y',
            cuffTop + 0.004 * k,
            cuffTop - 0.036 * k,
            () => ({ c: [x * legAt(k, ankle), 0.004 * k], r: [ankle * 0.94, ankle * 0.98], e: 0.95 }),
            { rings: 2, seg: 16, bump: (_t, v) => 0.04 * Math.sin(14 * v) },
          ),
          cloth,
          side === 'L' ? GROUP.legL : GROUP.legR,
          side === 'L' ? SEAM.cuffLegL : SEAM.cuffLegR,
          legSkin(s, side, k),
        ),
      )
      const shin = J[`shin.${side}`]
      const rest = at(s.rest, shin)
      decals.push({
        bone: shin,
        at: [x * (legAt(k, ankle) + ankle * 0.95) - rest[0], cuffTop - 0.03 * k - rest[1], 0.02 * k],
        normal: [x * 0.6, 0, 0.8],
        material: hardware,
        size: [1, 2],
      })
    }
  }
  // The bellows pockets: flat on the side-front of each thigh, below where the hand hangs, inside the leg's
  // line; the flap over each a tone lighter, its shadow a line under it.
  const pTop = 0.4
  const pBot = 0.6
  const flapBot = 0.47
  const half = 0.05 * k
  for (const [side, x] of SIDES) {
    const lg = side === 'L' ? GROUP.legL : GROUP.legR
    const vc = FRONT - x * 0.85
    const y = (t: number) => lerp(legTop, hem, t)
    const patch = (t0: number, t1: number, stand: number, wide: number) =>
      loft(
        'y',
        y(t0),
        y(t1),
        (u) => {
          const sec = section(x, lerp(t0, t1, u))
          return { ...sec, r: [sec.r[0] * stand, sec.r[1] * stand] }
        },
        {
          rings: 4,
          seg: 8,
          arc: (u) => {
            const a = (wide * half) / section(x, lerp(t0, t1, u)).r[0]
            return [vc - a, vc + a]
          },
        },
      )
    parts.push(
      skinned(
        patch(pTop, pBot, 1.05, 1),
        cloth,
        lg,
        side === 'L' ? SEAM.pocketL : SEAM.pocketR,
        legSkin(s, side, k),
      ),
    )
    parts.push(
      skinned(
        patch(pTop - 0.012, flapBot, 1.075, 1.1),
        flapCloth,
        lg,
        side === 'L' ? SEAM.flapL : SEAM.flapR,
        legSkin(s, side, k),
      ),
    )
    const thigh = J[`thigh.${side}`]
    const ty = y(flapBot) - 0.006 * k
    const sec = section(x, flapBot + 0.01)
    const a = (1.05 * half) / sec.r[0]
    for (let v = vc - a; v <= vc + a; v += 0.04) {
      const p: V3 = [sec.c[0] + Math.cos(v) * sec.r[0] * 1.055, ty, sec.c[1] + Math.sin(v) * sec.r[1] * 1.055]
      decals.push({
        bone: thigh,
        at: local(s, thigh, p),
        normal: [Math.cos(v), 0, Math.sin(v)],
        material: creaseCloth,
      })
    }
    // The hand in under the flap, from the side.
    const fy = y(pTop + 0.02)
    const fs = section(x, pTop + 0.02)
    const n: V3 = [Math.cos(vc), 0, Math.sin(vc)]
    anchors.push({
      kind: 'thighPocket',
      side,
      bone: thigh,
      at: [fs.c[0] + n[0] * fs.r[0] * 1.075, fy, fs.c[1] + n[2] * fs.r[1] * 1.075],
      open: normalize([-n[0], -0.3, -n[2]]),
    })
  }
  return { parts, decals, anchors, paint: { pelvis: cloth, thigh: cloth, knee: cloth, shin: cloth } }
}

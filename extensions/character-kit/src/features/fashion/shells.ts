// The body-fitted shells the runway's garments share. Every garment is sized from the body under it (`Wearing.body`): a shell
// is the body's own profile (torso, arm, leg) with each ring grown by a whole number of clearances (a texel each), cut to the
// garment's span, and skinned to the bones the body's own surface rides, so it clears any body the sliders make and holds
// still on it in the walk (the cloth coordinates are the body's own, fixed at build). The regions under each garment are
// painted its swatch too, so nothing of the skin shows through where a shell opens. A skirt or a coat's tail is a profile of
// its own, from the torso's girth at the waist and hips down to a hem that clears both legs.
//
// Ported from FigureBuilder's `claude/runway-video` (`demo/runway/wardrobe.ts`, `cb4aa9f`) onto its main through the door; the
// builder's own names (`GROUP`, `limb`, `weights`, ...) come from its kit entry.
import {
  axisAngle,
  type Fit,
  GROUP,
  J,
  type Limb,
  lerp,
  limb,
  type Part,
  qmul,
  type Ring,
  type Side,
  smooth,
  superquadric,
  type Wearing,
  weights,
} from '../../shared/figures/door.ts'

type Vec3 = readonly [number, number, number]
const at3 = (v: Vec3 | undefined): Vec3 => v ?? [0, 0, 0]
/** A joint's rest position. */
const restOf = (c: Wearing, bone: number): Vec3 => at3(c.s.rest[bone])
/** The ring at `i` of a profile (a profile always has them: the body's own). */
const ringOf = (limbOf: Limb, i: number): Ring => limbOf.rings[i] as Ring

/** How a vertex is skinned: the bones that carry a point of the body's surface, and their weights. */
type Skin = (x: number, y: number, z: number) => [number, number][]

/** The body's own skinning (the builder's `body()` in garments.ts), so a shell rides the bones its surface rides. */
function skins(c: Wearing) {
  const { s } = c
  const k = c.m.k
  const pelvisY = restOf(c, J.pelvis)[1]
  const spineY = restOf(c, J.spine)[1]
  const { chestY, hipY } = s
  const trunk: Skin = (_x, y) => {
    const lo = smooth((y - (pelvisY + 0.02 * k)) / (spineY - pelvisY))
    const hi = smooth((y - spineY) / (chestY - spineY))
    return [
      [J.pelvis, 1 - lo],
      [J.spine, lo * (1 - hi)],
      [J.chest, lo * hi],
    ]
  }
  const across =
    (upper: number, lower: number, y: number, soft: number) =>
    (py: number): [number, number][] => {
      const w = smooth((py - (y - soft)) / (2 * soft))
      return [
        [upper, w],
        [lower, 1 - w],
      ]
    }
  const arm = (side: Side): Skin => {
    const upper = J[`upperArm.${side}`]
    const ay = restOf(c, upper)[1]
    const bend = across(upper, J[`foreArm.${side}`], ay - s.upperArm, 0.05 * k)
    const shoulder = (y: number): [number, number][] => {
      const q = 0.45 * smooth((y - (ay - 0.03 * k)) / (0.07 * k))
      return [
        [J.chest, q],
        [upper, 1 - q],
      ]
    }
    return (_x, y) => (y > ay - 0.1 * k ? shoulder(y) : bend(y))
  }
  const leg = (side: Side): Skin => {
    const knee = hipY - s.thigh
    const bend = across(J[`thigh.${side}`], J[`shin.${side}`], knee, 0.05 * k)
    const hip = (y: number): [number, number][] => {
      const p = 0.55 * smooth((y - (hipY - 0.07 * k)) / (0.12 * k))
      return [
        [J.pelvis, p],
        [J[`thigh.${side}`], 1 - p],
      ]
    }
    return (_x, y) => (y > hipY - 0.1 * k ? hip(y) : bend(y))
  }
  return { trunk, arm, leg }
}

/** Both sides, with the x each stands at. */
export const SIDES = [
  ['L', 1],
  ['R', -1],
] as const
const armGroup = (side: Side) => (side === 'L' ? GROUP.armL : GROUP.armR)
const legGroup = (side: Side) => (side === 'L' ? GROUP.legL : GROUP.legR)

/** A profile grown by `off` (m, or per ring) on every ring, its other keys the body's own; `widen` may grow a ring further. */
const grown = (
  o: Limb,
  off: number | ((r: Ring, i: number) => number),
  widen?: (r: Ring) => Partial<Ring>,
): Limb => ({
  ...o,
  rings: o.rings.map((r, i) => {
    const d = typeof off === 'number' ? off : off(r, i)
    return { ...r, rx: r.rx + d, rz: r.rz + d, ...widen?.(r) }
  }),
})

/** A shell: the grown profile cut to [hi, lo], skinned by `skin`. */
function shell(
  o: Limb,
  hi: number,
  lo: number,
  material: string,
  group: number,
  skin: Skin,
  caps?: [number, number],
): Part {
  const mesh = limb({
    ...o,
    span: [hi, lo],
    ...((caps ?? o.caps) === undefined ? {} : { caps: caps ?? o.caps }),
  })
  return { mesh, material, group, skin: weights(mesh, skin) }
}

/** Heights on the body: the belt, the hip, the knee and the ankle; `hemAt` 0 the hip, 0.5 the knee, 1 the ankle. */
function heights(c: Wearing) {
  const { s } = c
  const k = c.m.k
  const { hipY } = s
  const knee = hipY - s.thigh
  const ankle = s.genes.ankle
  return {
    k,
    hipY,
    knee,
    ankle,
    belt: hipY + 0.09 * k,
    waist: hipY + 0.155 * k,
    hemAt: (l: number) =>
      l <= 0.5 ? hipY - (s.thigh * l) / 0.5 : knee - ((knee - ankle * 2) * (l - 0.5)) / 0.5,
  }
}

interface Top {
  /** `rolled`: the sleeve turned back to the elbow, the forearm bare; with `cuff` a fold of that cloth round the sleeve's end. */
  sleeves?: 'none' | 'short' | 'long' | 'rolled'
  cuff?: string
  ease?: number
  hem?: number
  sleeveEase?: number
}
/** The torso's rings at and above the shoulder line (the builder's fit profiles: the trapezius, the shoulder, the deltoid's top). */
export const SHOULDER_RINGS = 4

/**
 * A top's shell: the torso from the shoulders to `hem` (m above the floor), grown `ease` clearances below the shoulders and only
 * `sleeveEase` across them, so cloth follows the shoulder rather than puffing it; the sleeves, the arm grown `sleeveEase`
 * (about a texel) to the elbow's half (short) or the wrist (long). Paints the regions it covers.
 */
function top(c: Wearing, material: string, o: Top): Fit {
  const P = c.body.profiles
  const cl = c.body.clear
  const sk = skins(c)
  const { k } = heights(c)
  const { s } = c
  const ease = (o.ease ?? 1) * cl
  const sleeveEase = (o.sleeveEase ?? Math.min(1, o.ease ?? 1)) * cl
  const hem = o.hem ?? heights(c).belt - 0.02 * k
  const cap = Math.min(ease, sleeveEase)
  const torsoOff = (_r: Ring, i: number) =>
    i < SHOULDER_RINGS ? cap : i === SHOULDER_RINGS ? (cap + ease) / 2 : ease
  const parts: Part[] = [
    shell(grown(P.torso, torsoOff), Infinity, hem, material, GROUP.torso, sk.trunk, [
      P.torso.caps?.[0] ?? 0,
      0,
    ]),
  ]
  const sleeves = o.sleeves ?? 'short'
  if (sleeves !== 'none') {
    for (const [side] of SIDES) {
      const ay = restOf(c, J[`upperArm.${side}`])[1]
      const elbow = ay - s.upperArm
      const end =
        sleeves === 'long'
          ? ay - s.genes.arms + 0.045 * k
          : sleeves === 'rolled'
            ? elbow - 0.015 * k
            : ay - 0.55 * s.upperArm
      parts.push(
        shell(grown(P.arm[side], sleeveEase), Infinity, end, material, armGroup(side), sk.arm(side), [
          P.arm[side].caps?.[0] ?? 0,
          0,
        ]),
      )
      // The fold: the sleeve's last 4 cm turned over on itself, a clearance thicker all round, so its edge draws and its colour is its own.
      if (sleeves === 'rolled')
        parts.push(
          shell(
            grown(P.arm[side], sleeveEase + 1.2 * cl),
            end + 0.045 * k,
            end - 0.005 * k,
            o.cuff ?? material,
            armGroup(side),
            sk.arm(side),
            [0, 0],
          ),
        )
    }
  }
  const paint = {
    chest: material,
    waist: material,
    ...(sleeves !== 'none' ? { shoulder: material, upper: material } : {}),
    ...(sleeves === 'long' ? { fore: material } : {}),
  }
  return { parts, paint }
}

/**
 * A hanging tail (a skirt, a dress's skirt, a coat's skirts): a profile from `topY` down to the hem at `length`, round the torso's
 * girth at the waist and the hips and round both legs at the hem, `flare` widening the hem; the top rides the pelvis and the
 * lower rings follow each thigh by side.
 */
function tail(
  c: Wearing,
  material: string,
  topY: number,
  length: number,
  o: { ease?: number; flare?: number; group?: number },
): Part {
  const { k, hipY, hemAt } = heights(c)
  const cl = c.body.clear
  const ease = (o.ease ?? 2) * cl
  const bottom = hemAt(length)
  const girthOfTorso = (y0: number, y1: number) => c.body.girth('torso', 'L', y0, y1)
  const waist = girthOfTorso(topY + 0.01 * k, topY - 0.01 * k)
  const hips = girthOfTorso(hipY + 0.1 * k, hipY - 0.08 * k)
  // Round both legs at the hem: the widest the pair reaches across and front to back, plus the stride's room.
  const legs = (y: number) => {
    const L = c.body.girth('leg', 'L', y + 0.02 * k, y - 0.02 * k)
    return { rx: Math.abs(L.dx ?? 0) + L.rx, rz: L.rz + Math.abs(L.dz ?? 0) }
  }
  const flare = (o.flare ?? 0.4) * 0.08 * k
  const hemLegs = legs(Math.max(bottom, c.s.genes.ankle + 0.05 * k))
  const hemR: Ring = {
    y: bottom,
    rx: Math.max(hips.rx + ease, hemLegs.rx + ease) + flare * 0.6,
    rz: Math.max(hips.rz + ease, hemLegs.rz + ease + 0.03 * k) + flare,
    ...(hips.dz === undefined ? {} : { dz: hips.dz }),
  }
  const first: Ring = {
    y: topY,
    rx: waist.rx + ease,
    rz: waist.rz + ease,
    ...(waist.dz === undefined ? {} : { dz: waist.dz }),
  }
  const rings: Ring[] = [first]
  const hy = Math.min(topY - 0.03 * k, hipY)
  const hipR: Ring = {
    y: hy,
    rx: Math.max(hips.rx + ease, lerp(first.rx, hemR.rx, 0.4)),
    rz: Math.max(hips.rz + ease, lerp(first.rz, hemR.rz, 0.4)),
    ...(hips.dz === undefined ? {} : { dz: hips.dz }),
  }
  if (bottom < hy - 0.04 * k) rings.push(hipR)
  rings.push(hemR)
  const mesh = limb({ rings, seg: 24, e: 1, caps: [0, 0] })
  // The skin: the pelvis at the top, each side following its thigh further down.
  const from = hipY
  const follow = 0.7
  const width = hemR.rx
  return {
    mesh,
    material,
    group: o.group ?? GROUP.skirt,
    skin: weights(mesh, (x, y) => {
      const down = smooth((from - y) / Math.max(0.05, from - bottom)) * follow
      const left = smooth((x / width + 0.4) / 0.8)
      return [
        [J.pelvis, 1 - down],
        [J['thigh.L'], down * left],
        [J['thigh.R'], down * (1 - left)],
      ]
    }),
  }
}

/** A box rigid on a bone, placed in rest figure space (its bone's rest subtracted). */
function piece(
  c: Wearing,
  bone: number,
  material: string,
  group: number,
  place: [number, number, number],
  r: [number, number, number],
  more: { turn?: [number, number, number, number]; e?: [number, number] } = {},
): Part {
  const rest = restOf(c, bone)
  return {
    bone,
    material,
    group,
    mesh: superquadric({
      e: more.e ?? [0.4, 0.5],
      seg: 10,
      rings: 6,
      at: [place[0] - rest[0], place[1] - rest[1], place[2] - rest[2]],
      r,
      ...(more.turn === undefined ? {} : { turn: more.turn }),
    }),
  }
}

/** The torso's front surface (z) at a height, grown by `off`. */
const frontAt = (c: Wearing, y: number, off: number) => {
  const R = c.body.at('torso', 'L', y)
  return (R.dz ?? 0) + R.rz + off
}
/** The span of an open front: from the neck's root down to under the chest. */
const frontSpan = (c: Wearing): [number, number] => [
  ringOf(c.body.profiles.torso, 0).y + 0.01 * c.m.k,
  c.s.chestY - 0.1 * c.m.k,
]

/**
 * A patch of a torso shell grown `off`: the shell between two heights, keeping only the faces whose centre passes `keep` (rest
 * figure space), so a piece laid on the chest follows its every curve; finely cut (96 round, 3 mm rings) so its edge lands clean
 * on the texels.
 */
function patch(
  c: Wearing,
  material: string,
  off: number,
  topY: number,
  bottom: number,
  keep: (x: number, y: number, z: number) => boolean,
  on?: { readonly profile: Limb; readonly group: number; readonly skin: Skin },
): Part {
  const P = on?.profile ?? c.body.profiles.torso
  const mesh = limb({ ...grown(P, off), span: [topY, bottom], caps: [0, 0], seg: 96, step: 0.003 })
  const q = mesh.positions
  const n = (i: number) => q[i] ?? 0
  const idx: number[] = []
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const a = mesh.indices[i] ?? 0
    const b = mesh.indices[i + 1] ?? 0
    const d = mesh.indices[i + 2] ?? 0
    if (
      keep(
        (n(a * 3) + n(b * 3) + n(d * 3)) / 3,
        (n(a * 3 + 1) + n(b * 3 + 1) + n(d * 3 + 1)) / 3,
        (n(a * 3 + 2) + n(b * 3 + 2) + n(d * 3 + 2)) / 3,
      )
    ) {
      idx.push(a, b, d)
    }
  }
  // Only the kept faces' vertices: a cut patch leaves no stray points behind (the hair's trunk probe reads them).
  const map = new Map<number, number>()
  const out = { positions: [] as number[], normals: [] as number[], indices: [] as number[] }
  for (const v of idx) {
    let at = map.get(v)
    if (at === undefined) {
      at = map.size
      map.set(v, at)
      out.positions.push(n(v * 3), n(v * 3 + 1), n(v * 3 + 2))
      out.normals.push(mesh.normals[v * 3] ?? 0, mesh.normals[v * 3 + 1] ?? 0, mesh.normals[v * 3 + 2] ?? 0)
    }
    out.indices.push(at)
  }
  return {
    mesh: out,
    material,
    group: on?.group ?? GROUP.torso,
    skin: weights(out, on?.skin ?? skins(c).trunk),
  }
}

/** The V's half-width at a height: the neck's root's width at the top, nothing at the bottom. */
const vee = (c: Wearing, y: number) => {
  const [topY, bottom] = frontSpan(c)
  return ringOf(c.body.profiles.torso, 0).rx * 0.55 * Math.max(0, (y - bottom) / (topY - bottom))
}

/** How far a vest or jacket stands open on the cloth under it (`opening`): the options of the waistcoat that set it. */
export interface Panel {
  /** 0 the V of shirt the front always had, 1 a panel the whole way down to `hemY`; between, the one grows into the other. */
  readonly open: number
  /** The panel's half-width at the neck and at the hem, each as a share of the torso's own half-width at that height. */
  readonly chest: number
  readonly hem: number
  /** The height (m above the floor) the garment's front ends at, where the panel stops. */
  readonly hemY: number
}

/**
 * An open front: a V of the inner cloth (the shirt) on the jacket's front, from the neck's root to under the chest. With a `panel`
 * the V grows into a strip of the shirt of the character's own widths that runs on down to the garment's hem, and `open` 0 is the V.
 */
function opening(c: Wearing, material: string, off: number, panel?: Panel): Part {
  const [topY, bottom] = frontSpan(c)
  const open = panel?.open ?? 0
  if (panel === undefined || open <= 0)
    return patch(
      c,
      material,
      off + 0.35 * c.body.clear,
      topY,
      bottom,
      (x, y, z) => z > 0 && Math.abs(x) < vee(c, y),
    )
  const lo = lerp(bottom, Math.min(bottom, panel.hemY), open)
  const half = (y: number) => {
    const down = Math.min(1, Math.max(0, (y - panel.hemY) / (topY - panel.hemY)))
    return c.body.at('torso', 'L', y).rx * lerp(panel.hem, panel.chest, down)
  }
  return patch(
    c,
    material,
    off + 0.35 * c.body.clear,
    topY,
    lo,
    (x, y, z) => z > 0 && Math.abs(x) < lerp(vee(c, y), half(y), open),
  )
}

/** Lapels: a band of the jacket's own cloth either side of the V, standing a little off the shell, so their edge draws. */
function lapels(c: Wearing, material: string, off: number): Part[] {
  const [topY, bottom] = frontSpan(c)
  const w = 0.035 * c.m.k
  return [
    patch(
      c,
      material,
      off + 0.7 * c.body.clear,
      topY,
      bottom - 0.03 * c.m.k,
      (x, y, z) =>
        z > 0 &&
        Math.abs(x) >= vee(c, y) &&
        Math.abs(x) < vee(c, y) + w * (0.4 + (0.6 * (y - bottom)) / (topY - bottom)),
    ),
  ]
}

/** A standing collar round the neck's root, from the torso's top ring. */
function collarBand(c: Wearing, material: string, off: number): Part[] {
  const { k } = heights(c)
  const r0 = ringOf(c.body.profiles.torso, 0)
  return SIDES.map(([, x]) =>
    piece(
      c,
      J.chest,
      material,
      GROUP.torso,
      [x * (r0.rx * 0.55 + off), r0.y + 0.012 * k, (r0.dz ?? 0) + off * 0.5],
      [r0.rx * 0.5, 0.022 * k, r0.rz + off],
      {
        turn: axisAngle([0, 1, 0], x * 0.25),
        e: [0.35, 0.5],
      },
    ),
  )
}

/**
 * A shirt collar: a neckband round the neck's root and two leaves, each a flat piece lying from the band out over the shoulder and
 * down the chest, spread, with a point. Worn under a waistcoat whose neckline is lowered, the leaves lie over the vest's edge.
 */
function collarLeaves(c: Wearing, material: string, off: number): Part[] {
  const { k } = heights(c)
  const r0 = ringOf(c.body.profiles.torso, 0)
  const front = (r0.dz ?? 0) + r0.rz
  const band = piece(
    c,
    J.chest,
    material,
    GROUP.torso,
    [0, r0.y + 0.014 * k, r0.dz ?? 0],
    [r0.rx * 0.5 + off, 0.016 * k, r0.rz * 0.8 + off],
    { e: [0.5, 0.5] },
  )
  const leaves = SIDES.map(([, x]) =>
    piece(
      c,
      J.chest,
      material,
      GROUP.item,
      [x * (r0.rx * 0.42 + 0.014 * k + off), r0.y - 0.012 * k, front * 0.8 + off],
      [0.026 * k, 0.006 * k, 0.042 * k],
      {
        turn: qmul(
          axisAngle([0, 1, 0], x * 0.45),
          qmul(axisAngle([1, 0, 0], 0.55), axisAngle([0, 0, 1], x * 0.5)),
        ),
        e: [0.3, 0.45],
      },
    ),
  )
  return [band, ...leaves]
}

export {
  collarBand,
  collarLeaves,
  frontAt,
  grown,
  heights,
  lapels,
  legGroup,
  opening,
  patch,
  piece,
  shell,
  skins,
  tail,
  top,
}

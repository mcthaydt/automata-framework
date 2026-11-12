// The runway's nine garment kinds, registered on the figure builder's garment hook (H1, `registerGarment`): `tee` (any sleeve,
// any hem, a knit or a shirt), `hoodie`, `jacket` (wool or leather by its swatch's gloss), `coat`, `skirt`, `dress`, `jeans`,
// `trousers` and `shoes`. Each is sized from the body under it by `shells.ts`. Ported from FigureBuilder's `claude/runway-video`
// (`demo/runway/wardrobe.ts`, `cb4aa9f`), which was written against an older main: where `Wearing`, `Fit` or `Body` moved, the
// types here are main's. H2 (`registerOutfitHooks`) is not used: no kind here needs more than a kind's own `build`.
import { type GarmentKind, GROUP, J, lerp, registerGarment } from '../../shared/figures/door.ts'
import {
  type Belt,
  type Cap,
  type EyeMarks,
  registerAccessories,
  type Stockings,
  type Waistcoat,
} from './accessories.ts'
import {
  collarBand,
  collarLeaves,
  frontAt,
  grown,
  heights,
  lapels,
  legGroup,
  legsOf,
  opening,
  piece,
  SIDES,
  shell,
  skins,
  tail,
  top,
} from './shells.ts'

/** A tee (or a knit, a shirt): the torso and sleeves one clearance out, its hem `length` (0 the belt, 1 the hip's bottom). */
export interface Tee {
  tee: string
  sleeves?: 'none' | 'short' | 'long'
  ease?: number
  length?: number
}
/**
 * A shirt: close-cut, sleeves long to the wrist or `rolled` back to the elbow (`cuff` the cloth of the fold turned back) or short, and
 * a `collar` of that cloth: a neckband and two spread leaves, laid over the neckline of a waistcoat worn over it.
 */
export interface Shirt {
  shirt: string
  sleeves?: 'short' | 'long' | 'rolled'
  collar?: string
  cuff?: string
  ease?: number
  length?: number
}
/** A hoodie: roomy, long sleeves, the hood down behind the neck and a pouch pocket at the front in `trim`. */
export interface Hoodie {
  hoodie: string
  trim?: string
}
/** A jacket: over the shirt, to the hip, long sleeves, lapels (or a `collar`) and a zip line in `zip`; `inner` an open front with that cloth in a V. */
export interface Jacket {
  jacket: string
  collar?: string
  zip?: string
  inner?: string
}
/** A coat: long sleeves, lapels, its skirts from the waist to `length` (0 the hip, 0.5 the knee, 1 the ankle). */
export interface FashionCoat {
  coat: string
  length: number
  lapel?: string
}
/** A skirt from the waist to `length`, `flare` an A-line's spread. */
export interface FashionSkirt {
  skirt: string
  length: number
  flare?: number
  /** The clearance (in texels of cloth) the skirt stands off the body at the waist and the hips: 2 when left out, 0.5 for a skirt close to the body. */
  ease?: number
  /** A swatch whose paint stains the hem, climbing `stainHeight` (a share of the figure's height) from it. */
  stain?: string
  stainHeight?: number
}
/** A dress: a fitted bodice and its skirt from the waist, in one cloth. */
export interface Dress {
  dress: string
  length: number
  sleeves?: 'none' | 'short' | 'long'
  flare?: number
}
/** Jeans: close-cut legs. `taper` (0 a straight pipe from the knee, 1 the leg's own narrowing to the ankle) is the hem's cut. */
export interface Jeans {
  jeans: string
  taper?: number
  /** 0 … 1: how much of its clearance the inside of each leg's cloth gives up, so the floor shows between the legs below the knee. Default 0. */
  gap?: number
  /** An outer seam, a waistband, a cropped hem and a turn-up: each a cloth (or a share of the shin) the pair draws nothing of until it is named. */
  seam?: string
  waistband?: string
  crop?: number
  turn?: string
}
/** Trousers: roomier legs, `wide` the width they hold from the knee down and `taper` as for jeans. */
export interface Trousers {
  trousers: string
  wide?: number
  taper?: number
  /** As for jeans. */
  gap?: number
}
/** Shoes: the body's own shoe on its sole, painted. */
export interface Shoes {
  shoes: string
  sole?: string
  /** A boot: a shaft of the shoe's leather up the shin, over the trousers. */
  boots?: boolean
  /** How far up the shin a boot's shaft rises, as a share of the shin's length up from the ankle (default 0.42; 0.2 is an ankle boot). */
  shaft?: number
  /** A heel block under the shoe, 0 to 1 of the most the flat foot allows (the painter's `ShoeForm.heel`); none by default. */
  heel?: number
  /** A cloth for the toe cap: the front fifth of the shoe's upper (`ShoeForm.cap`). */
  toe?: string
}

// The painter widens its `Garment` union by augmentation: a kind declared here is a garment an outfit may list.
declare module '@automata/figures' {
  interface GarmentKinds {
    tee: Tee
    shirt: Shirt
    hoodie: Hoodie
    jacket: Jacket
    coat: FashionCoat
    skirt: FashionSkirt
    dress: Dress
    jeans: Jeans
    trousers: Trousers
    shoes: Shoes
    eyeMarks: EyeMarks
    waistcoat: Waistcoat
    legs: Stockings
    belt: Belt
    cap: Cap
  }
}

const kind = <T>(build: GarmentKind<T>['build']): GarmentKind<T> => ({ build })

/** Registers the ten kinds. The builder throws on a kind registered twice: `registerFashion` calls this once. */
export function registerGarments(): void {
  registerGarment(
    'tee',
    kind<Tee>((c, i) => {
      const h = heights(c)
      return top(c, i.tee, {
        sleeves: i.sleeves ?? 'short',
        ease: i.ease ?? 0.8,
        sleeveEase: 0.6,
        hem: lerp(h.belt - 0.02 * h.k, h.hipY - 0.06 * h.k, i.length ?? 0.3),
      })
    }),
  )
  registerGarment(
    'shirt',
    kind<Shirt>((c, i) => {
      const h = heights(c)
      const f = top(c, i.shirt, {
        sleeves: i.sleeves ?? 'long',
        ...(i.cuff === undefined ? {} : { cuff: i.cuff }),
        ease: i.ease ?? 0.8,
        sleeveEase: 0.6,
        hem: lerp(h.belt - 0.02 * h.k, h.hipY - 0.06 * h.k, i.length ?? 0.3),
      })
      if (i.collar !== undefined) f.parts.push(...collarLeaves(c, i.collar, 1.4 * c.body.clear))
      return f
    }),
  )
  registerGarment(
    'hoodie',
    kind<Hoodie>((c, i) => {
      const h = heights(c)
      const off = 2 * c.body.clear
      const f = top(c, i.hoodie, { sleeves: 'long', ease: 2, sleeveEase: 1, hem: h.hipY - 0.05 * h.k })
      const r0 = c.body.profiles.torso.rings[0]
      if (r0 === undefined) return f
      // The hood, down: a soft roll behind the neck and over the shoulders' tops.
      f.parts.push(
        piece(
          c,
          J.chest,
          i.hoodie,
          GROUP.torso,
          [0, r0.y + 0.01 * h.k, (r0.dz ?? 0) - r0.rz - off * 0.5],
          [r0.rx * 1.05 + off, 0.045 * h.k, 0.05 * h.k + off],
          { e: [0.6, 0.7] },
        ),
      )
      // The pouch: across the belly, on the shell's front.
      const py = h.belt + 0.01 * h.k
      f.parts.push(
        piece(
          c,
          J.pelvis,
          i.trim ?? i.hoodie,
          GROUP.torso,
          [0, py, frontAt(c, py, off) - 0.004 * h.k],
          [c.body.at('torso', 'L', py).rx * 0.62, 0.05 * h.k, 0.012 * h.k],
          { e: [0.3, 0.45] },
        ),
      )
      return f
    }),
  )
  registerGarment(
    'jacket',
    kind<Jacket>((c, i) => {
      const h = heights(c)
      const off = 1.8 * c.body.clear
      const f = top(c, i.jacket, { sleeves: 'long', ease: 1.8, sleeveEase: 1.2, hem: h.hipY - 0.02 * h.k })
      if (i.inner) f.parts.push(opening(c, i.inner, off))
      f.parts.push(...(i.collar ? collarBand(c, i.collar, off) : lapels(c, i.jacket, off)))
      const zip = i.zip
      if (zip) {
        f.decals = [0, 1, 2, 3].map((n) => {
          const y = lerp(c.s.chestY, h.belt, n / 3)
          const spine = c.s.rest[J.spine] ?? [0, 0, 0]
          return {
            bone: J.spine,
            at: [0, y - spine[1], frontAt(c, y, off) - spine[2]],
            normal: [0, 0, 1],
            material: zip,
          }
        })
      }
      return f
    }),
  )
  registerGarment(
    'coat',
    kind<FashionCoat>((c, i) => {
      const h = heights(c)
      const off = 2.5 * c.body.clear
      const f = top(c, i.coat, { sleeves: 'long', ease: 2.5, sleeveEase: 1.4, hem: h.belt - 0.04 * h.k })
      f.parts.push(
        tail(c, i.coat, h.belt, i.length, { ease: 2.5, flare: 0.6, group: GROUP.torso }),
        ...lapels(c, i.lapel ?? i.coat, off),
      )
      f.paint = { ...f.paint, pelvis: i.coat }
      if (i.length > 0.3) f.thighs = false
      return f
    }),
  )
  registerGarment(
    'skirt',
    kind<FashionSkirt>((c, i) => {
      const h = heights(c)
      // A stained hem is the skirt's own cloth, painted: the stain climbs from the hem in ragged runs (the painter's `stain`).
      const bottom = h.hemAt(i.length)
      const cloth = i.stain === undefined ? i.skirt : `${i.skirt}@stained`
      const materials =
        i.stain === undefined
          ? undefined
          : {
              [cloth]: {
                ...c.swatch(i.skirt),
                stain: {
                  paint: c.swatch(i.stain).paint ?? [],
                  hem: bottom,
                  below: bottom + (i.stainHeight ?? 0.1) * h.k,
                },
              },
            }
      return {
        parts: [
          tail(c, cloth, h.waist - 0.02 * h.k, i.length, {
            ease: i.ease ?? 2,
            ...(i.flare === undefined ? {} : { flare: i.flare }),
          }),
        ],
        ...(materials === undefined ? {} : { materials }),
        paint: { pelvis: i.skirt },
        thighs: i.length <= 0.3,
      }
    }),
  )
  registerGarment(
    'dress',
    kind<Dress>((c, i) => {
      const h = heights(c)
      const f = top(c, i.dress, { sleeves: i.sleeves ?? 'short', ease: 1, hem: h.waist - 0.04 * h.k })
      f.parts.push(
        tail(c, i.dress, h.waist - 0.02 * h.k, i.length, {
          ease: 2,
          ...(i.flare === undefined ? {} : { flare: i.flare }),
        }),
      )
      return { ...f, paint: { ...f.paint, pelvis: i.dress }, thighs: i.length <= 0.3 }
    }),
  )
  registerGarment(
    'jeans',
    kind<Jeans>((c, i) =>
      legsOf(c, i.jeans, 1, 0.92, i.taper, i.gap, {
        ...(i.seam === undefined ? {} : { seam: i.seam }),
        ...(i.waistband === undefined ? {} : { waistband: i.waistband }),
        ...(i.crop === undefined ? {} : { crop: i.crop }),
        ...(i.turn === undefined ? {} : { turn: i.turn }),
      }),
    ),
  )
  registerGarment(
    'trousers',
    kind<Trousers>((c, i) => legsOf(c, i.trousers, 1.5, i.wide ?? 1.05, i.taper, i.gap)),
  )
  registerGarment('shoes', {
    build: (_c, i: Shoes) => ({
      parts: [],
      paint: { shoe: i.shoes, sole: i.sole ?? 'soleBlack' },
      ...(i.heel === undefined && i.toe === undefined
        ? {}
        : {
            shoe: {
              ...(i.heel === undefined ? {} : { heel: i.heel }),
              ...(i.toe === undefined ? {} : { cap: i.toe }),
            },
          }),
    }),
    // A boot's shaft is built after the rest, so it lies over the trousers: each leg's profile from under the knee, grown past the
    // trouser leg, over the lower part of the shin.
    after: (c, i: Shoes) => {
      if (i.boots !== true) return { parts: [] }
      const h = heights(c)
      const sk = skins(c)
      const off = 2.4 * c.body.clear
      return {
        parts: SIDES.map(([side]) => {
          const kneeR = c.body.at('leg', side, h.knee - 0.4 * c.s.shin)
          const wide = (r: { y: number; rx: number; rz: number }) =>
            r.y < h.knee
              ? { rx: Math.max(r.rx, kneeR.rx * 1.05) + off, rz: Math.max(r.rz, kneeR.rz * 1.05) + off }
              : {}
          return shell(
            grown(c.body.profiles.leg[side], off, wide),
            h.knee - (i.shaft === undefined ? 0.58 : 1 - i.shaft) * c.s.shin,
            h.ankle + 0.015 * h.k,
            i.shoes,
            legGroup(side),
            sk.leg(side),
            [0, 0],
          )
        }),
      }
    },
  })
  registerAccessories()
}

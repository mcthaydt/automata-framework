// The runway's nine garment kinds, registered on the figure builder's garment hook (H1, `registerGarment`): `tee` (any sleeve,
// any hem, a knit or a shirt), `hoodie`, `jacket` (wool or leather by its swatch's gloss), `coat`, `skirt`, `dress`, `jeans`,
// `trousers` and `shoes`. Each is sized from the body under it by `shells.ts`. Ported from FigureBuilder's `claude/runway-video`
// (`demo/runway/wardrobe.ts`, `cb4aa9f`), which was written against an older main: where `Wearing`, `Fit` or `Body` moved, the
// types here are main's. H2 (`registerOutfitHooks`) is not used: no kind here needs more than a kind's own `build`.
import { type GarmentKind, GROUP, J, lerp, registerGarment } from '../../shared/figure-builder/door.ts'
import { collarBand, frontAt, heights, lapels, legsOf, opening, piece, tail, top } from './shells.ts'

/** A tee (or a knit, a shirt): the torso and sleeves one clearance out, its hem `length` (0 the belt, 1 the hip's bottom). */
export interface Tee {
  tee: string
  sleeves?: 'none' | 'short' | 'long'
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
}
/** A dress: a fitted bodice and its skirt from the waist, in one cloth. */
export interface Dress {
  dress: string
  length: number
  sleeves?: 'none' | 'short' | 'long'
  flare?: number
}
export interface Jeans {
  jeans: string
}
export interface Trousers {
  trousers: string
  wide?: number
}
/** Shoes: the body's own shoe on its sole, painted. */
export interface Shoes {
  shoes: string
  sole?: string
}

// The painter widens its `Garment` union by augmentation: a kind declared here is a garment an outfit may list.
declare module '@automata/figures' {
  interface GarmentKinds {
    tee: Tee
    hoodie: Hoodie
    jacket: Jacket
    coat: FashionCoat
    skirt: FashionSkirt
    dress: Dress
    jeans: Jeans
    trousers: Trousers
    shoes: Shoes
  }
}

const kind = <T>(build: GarmentKind<T>['build']): GarmentKind<T> => ({ build })

/** Registers the nine kinds. The builder throws on a kind registered twice: `registerFashion` calls this once. */
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
      return {
        parts: [
          tail(c, i.skirt, h.waist - 0.02 * h.k, i.length, {
            ease: 2,
            ...(i.flare === undefined ? {} : { flare: i.flare }),
          }),
        ],
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
    kind<Jeans>((c, i) => legsOf(c, i.jeans, 1, 0.92)),
  )
  registerGarment(
    'trousers',
    kind<Trousers>((c, i) => legsOf(c, i.trousers, 1.5, i.wide ?? 1.05)),
  )
  registerGarment(
    'shoes',
    kind<Shoes>((_c, i) => ({ parts: [], paint: { shoe: i.shoes, sole: i.sole ?? 'soleBlack' } })),
  )
}

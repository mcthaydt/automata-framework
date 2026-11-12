// The painted wardrobe's accessories: what the old game's Ada and Night Nurse wear over and under the runway's nine kinds, on the
// builder's garment hook (H1, `registerGarment`) like them. The mesh figures have a waistcoat, `legs`, a belt and a mark already
// (`../garments/`), but that registry has another kind shape, so before these a painted character that named one was dressed
// without it, silently. Each is sized from the body under it, as the runway's are (`shells.ts`).
//
//   waistcoat  a vest over the chest, its front open on whatever tee is under it
//   legs       stockings: the legs from the thigh down in one colour (a skirt's hem shows them)
//   belt       a band round the waist, with a buckle in front
//   cap        headwear (`headwear.ts`): the hair is drawn under it; a style may carry a mark
//
// A boot's shaft is the runway's `shoes` with `boots: true` (`garments.ts`), built after the rest so it lies over the trousers.
import {
  axisAngle,
  type Fit,
  type GarmentKind,
  GROUP,
  J,
  type Part,
  registerGarment,
  superquadric,
  type Wearing,
} from '../../shared/figure-builder/door.ts'
import { HEADWEAR } from './headwear.ts'
import { frontAt, grown, heights, opening, piece, shell, skins, top } from './shells.ts'

/** A vest: it covers the chest and waist; its front is open on the shirt under it. */
export interface Waistcoat {
  waistcoat: string
}
/** Stockings, in one colour. */
export interface Stockings {
  legs: string
}
/** A belt round the waist; `buckle` is the colour of the plate in front. */
export interface Belt {
  belt: string
  buckle?: string
}
/** Headwear in `cloth`, of a named `style` of `HEADWEAR`; `mark` is the colour of the style's mark (a cross on a nurse's cap). */
export interface Cap {
  cap: string
  style: string
  mark?: string
}

declare module 'figure-builder' {
  interface GarmentKinds {
    waistcoat: Waistcoat
    legs: Stockings
    belt: Belt
    cap: Cap
  }
}

/** The cloth of the shirt an outfit wears, the one a vest opens on: a `top` or a `tee`. */
const shirtOf = (c: Wearing): string | undefined => {
  for (const g of c.garments) {
    if ('top' in g) return g.top
    if ('tee' in g) return g.tee
  }
  return undefined
}

const kind = <T>(build: GarmentKind<T>['build'], more: Partial<GarmentKind<T>> = {}): GarmentKind<T> => ({
  build,
  ...more,
})

/** How far a belt stands off the body: past the roomiest cloth an outfit puts at the waist (a coat is 2.5 clearances). */
const BELT_EASE = 3

function waistcoat(c: Wearing, i: Waistcoat): Fit {
  const h = heights(c)
  const ease = 1.6
  const f = top(c, i.waistcoat, { sleeves: 'none', ease, sleeveEase: ease, hem: h.belt + 0.01 * h.k })
  const shirt = shirtOf(c)
  if (shirt !== undefined) f.parts.push(opening(c, shirt, ease * c.body.clear))
  return f
}

function belt(c: Wearing, i: Belt): Fit {
  const h = heights(c)
  const y = h.hipY + 0.14 * h.k
  const off = BELT_EASE * c.body.clear
  const half = 0.0225 * h.k
  const parts: Part[] = [
    shell(grown(c.body.profiles.torso, off), y + half, y - half, i.belt, GROUP.torso, skins(c).trunk, [0, 0]),
  ]
  // The plate is a little bigger than the old game's (0.036 by 0.024): the painter drops a part under about two texels, and a plate
  // that size vanished at density 2.
  if (i.buckle !== undefined)
    parts.push(
      piece(
        c,
        J.pelvis,
        i.buckle,
        GROUP.torso,
        [0, y, frontAt(c, y, off) + 0.004 * h.k],
        [0.045 * h.k, 0.03 * h.k, 0.03 * h.k],
        { e: [0.3, 0.4] },
      ),
    )
  return { parts }
}

function cap(c: Wearing, i: Cap): Fit {
  const wear = HEADWEAR[i.style]
  if (wear === undefined)
    throw new Error(`no headwear ${i.style}; the headwear is ${Object.keys(HEADWEAR).join(', ')}`)
  const { k } = heights(c)
  const { head, headWidth, headDepth } = c.s.genes
  const [hw, hd] = [(head * headWidth) / 2, (head * headDepth) / 2]
  const parts: Part[] = wear.pieces.map((p) => {
    const rk = p.rk ?? [0, 0, 0]
    return {
      bone: J.head,
      material: i.cap,
      group: GROUP.hair,
      mesh: superquadric({
        at: [hw * p.at[0], head * p.at[1], hd * p.at[2]],
        r: [hw * p.r[0] + k * rk[0], head * p.r[1] + k * rk[1], hd * p.r[2] + k * rk[2]],
        e: p.e ? [p.e[0], p.e[1]] : [0.5, 0.55],
        seg: 10,
        rings: 6,
        ...(p.taper ? { taper: [p.taper[0], p.taper[1]] as [number, number] } : {}),
        ...(p.pitch === undefined ? {} : { turn: axisAngle([1, 0, 0], p.pitch) }),
      }),
    }
  })
  const mark = wear.mark
  if (i.mark === undefined || mark === undefined) return { parts }
  const atk = mark.atk ?? [0, 0, 0]
  return {
    parts,
    decals: (mark.sizes ?? [undefined]).map((size) => ({
      bone: J.head,
      at: [hw * mark.at[0] + k * atk[0], head * mark.at[1] + k * atk[1], hd * mark.at[2] + k * atk[2]],
      normal: [mark.normal[0], mark.normal[1], mark.normal[2]],
      material: i.mark as string,
      ...(size === undefined ? {} : { size: [size[0], size[1]] as [number, number] }),
    })),
  }
}

/** Registers the four kinds; `registerGarments` calls this once, after the runway's nine. */
export function registerAccessories(): void {
  registerGarment('waistcoat', kind<Waistcoat>(waistcoat))
  registerGarment(
    'legs',
    kind<Stockings>((_c, i) => ({ parts: [], paint: { thigh: i.legs, knee: i.legs, shin: i.legs } })),
  )
  // A belt is worn over what is at the waist, so it is built last.
  registerGarment('belt', kind<Belt>(belt, { last: true }))
  registerGarment('cap', kind<Cap>(cap, { coversHair: () => ({}) }))
}

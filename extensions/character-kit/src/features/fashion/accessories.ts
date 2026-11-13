// The painted wardrobe's accessories: what a painted cast wears over and under the runway's nine kinds, on the
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
  lerp,
  type Part,
  type Ring,
  registerGarment,
  smooth,
  superquadric,
  type Wearing,
} from '../../shared/figures/door.ts'
import { HEADWEAR } from './headwear.ts'
import { frontAt, grown, heights, opening, piece, SHOULDER_RINGS, shell, skins } from './shells.ts'

/**
 * A vest: it covers the chest and waist, its front open on the shirt under it. It is cut from the torso (the body's own rings grown by
 * a little cloth) and each of its options is a way the cut follows the body:
 */
export interface Waistcoat {
  waistcoat: string
  /** 0 a loose vest, 1 a fitted one: the cloth clears the body by the same at the chest, and by less and less toward the waist. Default 0 (loose, as it was drawn before the options). */
  fit?: number
  /** Where it ends, 0 at the waist (a short, cropped vest) to 1 at the hip (a long one). Left out, a hand over the belt, as it was drawn before this option. */
  length?: number
  /** 0 … 1: the vest narrows across the shoulder, so the shirt shows at the arm and it hangs from straps, not from the arm's cap. Default 0. */
  armhole?: number
  /** 0 … 1: how far the front stands open on the shirt. 0 a V of shirt that closes under the chest (as it was drawn before), 1 a strip of shirt from the collar to the hem between the two sides. Default 0. */
  open?: number
  /** With `open`: the strip's half-width at the neck and at the hem, each as a share of the torso's half-width there (about 0.3 and 0.2 a vest worn open). */
  chest?: number
  hem?: number
  /** With `open`: how far down the vest, from the neck's root to the hem, the strip of shirt runs: 1 to the hem (the default), 0.4 a short V over the chest. */
  vend?: number
  /** 0 … 1: how far below the neck the vest starts, so the shirt's collar shows above it. Default 0. */
  neckline?: number
  /** A cloth for a row of buttons down the front of each side of the opening (about 12 mm round), from the neckline to the hem. */
  buttons?: string
  /** How many buttons in each row (default 3). */
  buttonCount?: number
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

/**
 * The eyes of a face that is not drawn (the decal face the play size uses), where the builder's `eyes` is one texel each, two apart: here
 * they have a `size` (texels, 1 by 2 when left out: the old figures' are two tall) and sit `spread` of the head's half-width either side
 * of the middle (0.6 left out: about four texels apart on a head nine wide) at `height` of the head's height up from the chin (0.45, the
 * builder's own). The colour is `eyeMarks`, a swatch. A drawn face draws its own eyes and leaves these out.
 */
export interface EyeMarks {
  eyeMarks: string
  size?: [number, number]
  spread?: number
  height?: number
}

// The painter's `GarmentKinds` is widened for these five in `garments.ts`, the one module augmentation outside the door.

/** The cloth of the shirt an outfit wears, the one a vest opens on: a `top`, a `tee` or a `shirt`. */
const shirtOf = (c: Wearing): string | undefined => {
  for (const g of c.garments) {
    if ('top' in g) return g.top
    if ('tee' in g) return g.tee
    if ('shirt' in g) return g.shirt
  }
  return undefined
}

const kind = <T>(build: GarmentKind<T>['build'], more: Partial<GarmentKind<T>> = {}): GarmentKind<T> => ({
  build,
  ...more,
})

/** How far a belt stands off the body: past the roomiest cloth an outfit puts at the waist (a coat is 2.5 clearances). */
const BELT_EASE = 3

/** The clearance (in texels of cloth) a vest stands off the chest, and the least it keeps off the waist: a shirt under it is 0.8, so a fitted waist is just over it. */
const VEST_CHEST = 1.6
const VEST_WAIST = 0.9
/** The most the neckline drops below the neck's root (a share of the figure's height): a few centimetres, two texels at the play size. */
const VEST_NECKLINE = 0.05
/** The shirt's strip, when the vest stands open and names no widths: the share of the torso's half-width at the neck and at the hem. */
const PANEL_CHEST = 0.3
const PANEL_HEM = 0.2
/** How much of its half-width the vest gives up at the shoulder when it is all armhole, at the ring where the arm leaves the trunk. */
const VEST_ARMHOLE = 0.3

/**
 * A waistcoat: the torso's rings from the neck to a hem the character sets, grown a vest's clearance. The clearance is the chest's
 * down to the chest's underside, eases to the waist's at the waist, and is the chest's again at the hip, so a fitted vest follows the
 * body in at the waist and out over the hip instead of hanging as a tube; the rings at the shoulder narrow by `armhole` so the
 * shirt's sleeve shows at the arm.
 */
function waistcoat(c: Wearing, i: Waistcoat): Fit {
  const h = heights(c)
  const cl = c.body.clear
  const torso = c.body.profiles.torso
  const fit = i.fit ?? 0
  const hem = i.length === undefined ? h.belt + 0.01 * h.k : lerp(h.waist, h.hipY, i.length)
  const armhole = (i.armhole ?? 0) * VEST_ARMHOLE
  // The torso's own waist and hip rings (builder's fit profile): the vest is closest at the first and as roomy as the chest at the second.
  const waistY = h.waist + 0.02 * h.k
  const hipRingY = h.hipY + 0.08 * h.k
  const chestRingY = c.s.chestY - 0.07 * h.k
  const waistEase = lerp(VEST_CHEST, VEST_WAIST, fit)
  const ease = (r: Ring, at: number): number => {
    if (at < SHOULDER_RINGS) return VEST_CHEST * cl
    const away = r.y >= waistY ? (r.y - waistY) / (chestRingY - waistY) : (waistY - r.y) / (waistY - hipRingY)
    // The chest's clearance less what the waist gives up: exactly the chest's where the waist gives up nothing (fit 0).
    return (VEST_CHEST - (VEST_CHEST - waistEase) * (1 - smooth(away))) * cl
  }
  // Rings 1 to 3 carry the shoulder's slope and the arm's root: they narrow most at the shoulder's own ring (2).
  const armholeAt = (at: number) => armhole * (at === 2 ? 1 : at === 1 || at === 3 ? 0.5 : 0)
  const cut = {
    ...torso,
    rings: torso.rings.map((r, at) => ({
      ...r,
      rx: r.rx * (1 - armholeAt(at)) + ease(r, at),
      rz: r.rz + ease(r, at),
    })),
  }
  // The torso's first ring is the neck's root: the vest's top edge drops below it by `neckline`, or is not cut at all.
  const neckline = i.neckline ?? 0
  const top = neckline > 0 ? (torso.rings[0] as Ring).y - neckline * VEST_NECKLINE * h.k : Infinity
  const parts: Part[] = [
    shell(cut, top, hem, i.waistcoat, GROUP.torso, skins(c).trunk, [torso.caps?.[0] ?? 0, 0]),
  ]
  const shirt = shirtOf(c)
  const panel = {
    open: i.open ?? 0,
    chest: i.chest ?? PANEL_CHEST,
    hem: i.hem ?? PANEL_HEM,
    hemY: i.vend === undefined ? hem : lerp((torso.rings[0] as Ring).y, hem, i.vend),
  }
  if (shirt !== undefined) parts.push(opening(c, shirt, VEST_CHEST * cl, panel))
  const buttons = i.buttons
  const rest = c.s.rest[J.spine] ?? [0, 0, 0]
  const first = top === Infinity ? (torso.rings[0] as Ring).y : top
  const n = i.buttonCount ?? 3
  // A button sits on the vest's front a little off the opening's edge, so a worn-open vest has its row on each flap.
  const decals =
    buttons === undefined
      ? undefined
      : [-1, 1].flatMap((side) =>
          Array.from({ length: n }, (_, k) => {
            const y = lerp(first - 0.07 * h.k, hem + 0.045 * h.k, n === 1 ? 0 : k / (n - 1))
            const ring = c.body.at('torso', 'L', y)
            const half =
              ring.rx * lerp(panel.hem, panel.chest, Math.min(1, Math.max(0, (y - hem) / (first - hem))))
            const x = side * (half + 0.03 * h.k)
            const across = Math.min(0.95, Math.abs(x) / ring.rx)
            const z = (ring.dz ?? 0) + ring.rz * Math.sqrt(1 - across * across) + (VEST_CHEST + 1.5) * cl
            return {
              bone: J.spine,
              at: [x - rest[0], y - rest[1], z - rest[2]] as [number, number, number],
              normal: [side * across * 0.6, 0, 0.8] as [number, number, number],
              material: buttons,
              size: [3, 3] as [number, number],
            }
          }),
        )
  return {
    parts,
    paint: { chest: i.waistcoat, waist: i.waistcoat },
    ...(decals === undefined ? {} : { decals }),
  }
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

function eyeMarks(c: Wearing, i: EyeMarks): Fit {
  const { head, headWidth, headDepth, faceAhead } = c.s.genes
  const hw = (head * headWidth) / 2
  const front = (head * headDepth * (1 + faceAhead)) / 2 + 0.006
  const [x, y] = [hw * (i.spread ?? 0.6), head * (i.height ?? 0.45)]
  const size = i.size ?? [1, 2]
  return {
    parts: [],
    decals: [1, -1].map((side) => ({
      bone: J.head,
      at: [side * x, y, front],
      normal: [side * 0.5, 0, 0.86],
      material: i.eyeMarks,
      size: [size[0], size[1]],
      blink: false,
      tag: 'face',
    })),
  }
}

/** Registers the five kinds; `registerGarments` calls this once, after the runway's nine. */
export function registerAccessories(): void {
  registerGarment('eyeMarks', kind<EyeMarks>(eyeMarks))
  registerGarment('waistcoat', kind<Waistcoat>(waistcoat))
  registerGarment(
    'legs',
    kind<Stockings>((_c, i) => ({ parts: [], paint: { thigh: i.legs, knee: i.legs, shin: i.legs } })),
  )
  // A belt is worn over what is at the waist, so it is built last.
  registerGarment('belt', kind<Belt>(belt, { last: true }))
  registerGarment('cap', kind<Cap>(cap, { coversHair: () => ({}) }))
}

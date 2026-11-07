// The streetwear garments' item shapes: what a figure file's garment of each kind holds. Each is an object named by
// its first key (`hoodie`, `tee`, `bomber`…), whose value is its cloth's swatch, like the classic garments core types
// (FigureBuilder src/render/figure/streetwear.ts's garment shapes at a1f7246). Left out: streetwear's `graphics`
// and the chain's `pendant` (the SNEKPRTY marks and plates stay in FigureBuilder) and the wide-legs' `fade`.

/**
 * A cropped puffer: quilted baffles, a high collar, full sleeves; `length` 0 ends it at the waist, 1 at the
 * hip.
 */
export interface Puffer {
  readonly puffer: string
  readonly trim?: string | undefined
  readonly zip?: string | undefined
  /** The zip's pull at the chin. */
  readonly pull?: string | undefined
  readonly length?: number | undefined
  readonly baffles?: number | undefined
}
/**
 * A hoodie: the hood lying on the back, a kangaroo pocket, drawstrings (`aglets` their tips), ribbed cuffs
 * and hem.
 */
export interface Hoodie {
  readonly hoodie: string
  readonly rib?: string | undefined
  readonly inside?: string | undefined
  readonly cords?: string | undefined
  readonly aglets?: string | undefined
}
/** An oversized tee: `fit` its width over the shoulders (1.16 oversized); `sleeves: false` under a jacket. */
export interface Tee {
  readonly tee: string
  readonly rib?: string | undefined
  readonly fit?: number | undefined
  readonly sleeves?: boolean | undefined
  readonly length?: number | undefined
}
/**
 * A moto jacket cropped to the waist: `zip` its teeth top to foot, `hardware` the buckle, snaps and small
 * zips.
 */
export interface Jacket {
  readonly jacket: string
  readonly zip?: readonly string[] | undefined
  readonly hardware?: string | undefined
}
/**
 * A leather bomber: rib band, collar and cuffs, a centre zip, slash pockets; `tipping` a stripe round the
 * rib.
 */
export interface Bomber {
  readonly bomber: string
  readonly rib?: string | undefined
  readonly zip?: readonly string[] | undefined
  readonly hardware?: string | undefined
  readonly tipping?: string | undefined
}
/** Wide-leg trousers with a stacked break over the shoe; `stitch` the topstitching. */
export interface WideLegs {
  readonly wideLegs: string
  readonly stitch?: string | undefined
  readonly hardware?: string | undefined
}
/**
 * Cargos: wide and straight (`width` of the era's cut), bellows pockets; `cuff` gathers the ankle instead.
 */
export interface Cargos {
  readonly cargos: string
  readonly hardware?: string | undefined
  readonly width?: number | undefined
  readonly cuff?: boolean | undefined
  readonly stitch?: string | undefined
}
/** Chunky sneakers: a thick two-tone sole, a padded collar, a mudguard; `court` a cupsole's flat sole. */
export interface Sneakers {
  readonly sneakers: string
  readonly mudguard?: string | undefined
  readonly sole?: string | undefined
  readonly outsole?: string | undefined
  readonly laces?: string | undefined
  readonly court?: boolean | undefined
  readonly tab?: string | undefined
}
/** A chain round the neck lying on the outermost top, `drop` (m at 1.62 m) its U's depth on the chest. */
export interface Chain {
  readonly chain: string
  readonly links?: string | undefined
  readonly drop?: number | undefined
}
/** Hoops from the lobes, `size` their drop (of the head's height; under 0.12 a stud). */
export interface Hoops {
  readonly hoops: string
  readonly size?: number | undefined
}
/** Wraparound shades; `up` pushed back onto the head. */
export interface Shades {
  readonly shades: string
  readonly frame?: string | undefined
  readonly up?: boolean | undefined
}

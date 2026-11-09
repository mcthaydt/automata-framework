// A swatch's `texture`: a library photo and the knobs the photo pipeline reads. The defaults are written once, so the
// tile maker, the structure checks and the swatch library read the same numbers; a swatch that names every knob makes
// the tile it makes without.

/** A swatch's texture. */
export interface TextureSpec {
  /** The library photo. */
  readonly photo: string
  /** 'tone' (default): the photo's light on the swatch's ladder (and its accent's). 'photo': its own colours. */
  readonly colour?: 'tone' | 'photo' | undefined
  /** Scales the photo's size in the world (2: each brick twice as big). */
  readonly scale?: number | undefined
  /** Turns the photo a quarter (planks run up a wall instead of across). */
  readonly turn?: boolean | undefined
  /** The facet radius, in texels of the imported photo (0 for none). */
  readonly facet?: number | undefined
  /** How much of the photo's slow light changes are taken out (0 to 1). */
  readonly flatten?: number | undefined
  /** Tone mode: the OKLab lightness a tone step spans. */
  readonly contrast?: number | undefined
  /** Tone mode: the offsets kept, lowest and highest. */
  readonly range?: readonly [number, number] | undefined
  /** Tone mode: the hue distance that takes the accent (0 for none). */
  readonly accent?: number | undefined
  /** Photo mode: how many colours the photo keeps before they snap to DUEL. */
  readonly colours?: number | undefined
  /** The smallest cluster, in texels, the clean-up keeps. */
  readonly cluster?: number | undefined
  /** Worn patches a step darker (0 new to 1 derelict). */
  readonly wear?: number | undefined
  /** Shifts where the tile wears, so two walls of one photo differ. */
  readonly seed?: number | undefined
}

/** What a texture's knobs are when its swatch sets none. */
export const TEXTURE_DEFAULTS = {
  scale: 1,
  facet: 1,
  flatten: 0.85,
  contrast: 0.07,
  range: [-2, 1] as readonly [number, number],
  accent: 0.06,
  colours: 8,
  cluster: 4,
  wear: 0.3,
  seed: 0,
} as const

/** A texel scale (texels a metre) snapped to the pipeline's √2 steps, 3 to 200: a tile is made at a few scales, not every
 * one a surface might be seen at. */
export function texelScale(texelsPerMetre: number): number {
  const steps = Math.round(Math.log2(Math.max(1e-3, texelsPerMetre)) * 2)
  return Math.min(200, Math.max(3, 2 ** (Math.max(0, Math.min(63, steps)) / 2)))
}

// A hair piece's tone as a material: the hair's swatch, its lit strands a step up, the partings between
// braids in its deep, a fade's tiers between the hair and the skin, the scalp the skin's shadow.
// FigureBuilder makes each a painter ramp from the DUEL rows; AF keeps the swatch's palette colour and
// records the tone step for the view (build/materials.ts). A finish (coil, braid, loc) is matte: no gloss on
// its hair or its lit tone.
//
// Replaces FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/hair.ts at a1f7246 `FINISH`, `finish` and
// `raise` (the painter's tones; M3 spec §4.4.1: the painter stays in FigureBuilder). The finishes' matteness
// and each tone's place are the source's.

import type { HAIR_FINISHES } from '../content/hair.schema.ts'
import { type Made, variant } from '../figure/materials.ts'

export type Finish = (typeof HAIR_FINISHES)[number]
/** Matte finishes, as the source's FINISH table has them. */
const MATTE: Readonly<Record<Finish, boolean>> = {
  coil: true,
  braid: true,
  loc: true,
  sleek: false,
  straight: false,
}

/** The hair's own tones; anything else is a swatch id, used as it is. */
const TONES = ['hair', 'lit', 'crest', 'fade1', 'fade2', 'scalp', 'parting'] as const

/** A piece's material in a tone: `hair` and `skin` are swatch ids, `finish` the style's. */
export function toneOf(
  made: Made,
  hair: string,
  skin: string,
  finish: Finish,
  tone: string,
  matte = false,
): string {
  if (!(TONES as readonly string[]).includes(tone)) return tone
  const dull = matte || MATTE[finish]
  const as = (of: string, role: string, shade: number) =>
    variant(made, of, `${role}${dull ? '~matte' : ''}`, {
      ...(shade ? { shade } : {}),
      ...(dull ? { matte: true } : {}),
    })
  switch (tone) {
    case 'hair':
      return dull ? as(hair, 'hair', 0) : hair
    // The lit tone and the crest (a high-top's flat top in the light): a step up.
    case 'lit':
      return as(hair, 'lit', 1)
    case 'crest':
      return as(hair, 'crest', 1)
    // The partings between ropes: the hair's deep.
    case 'parting':
      return as(hair, 'parting', -2)
    // The ground between cornrows: the skin's own tone in shadow, never glossy.
    case 'scalp':
      return variant(made, skin, 'scalp', { shade: -1, matte: true })
    // A fade's tiers: nearer the hair its shadow, nearer the skin the skin's shadow (the painter mixes the
    // two).
    case 'fade1':
      return variant(made, hair, 'fade1', { shade: -1, matte: true })
    default:
      return variant(made, skin, 'fade2', { shade: -1, matte: true })
  }
}

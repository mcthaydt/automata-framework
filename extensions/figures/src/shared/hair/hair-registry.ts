import type { Material } from '../body/parts'
import { hexOf } from '../math/colour'
import { RAMPS } from '../paint/duel-ramps'
import { tonesOf } from '../paint/paint'
import { hairSchema } from './hair.schema'
import type { Finish, HairFinish, HairInput, HairPiece, HairStyle, Tone } from './hair-types'
import hairLibrary from './library/hair.json'
/**
 * Hair generators (library/hair.json). A style is a list of pieces fitted to the
 * skull in head units: angles round it from the front (rad, + toward the figure's left, mirrored), heights of its
 * half-height about its middle (−1 the chin … 1 the crown), sizes of its half-width; so any head the sliders make
 * wears it. The pieces:
 *
 * - scalp: a shell on the skull from a hairline up to the crown, or a band between two lines (a fade), lifted off it,
 *   fuller at the crown and ridged the way the hair is combed, so its sheen breaks into bands along the strands.
 * - rows: ropes laid on the scalp from the hairline to a point: braids gathered up into a pony, cornrows to the nape.
 * - tail: a ponytail's ropes, rising from the crown and falling down the back, clear of the body, to below the shoulders.
 *
 * A fork adds pieces of its own (registerHairPiece, built from HairCtx's helpers) and finishes (registerFinish); base
 * registers none.
 *
 * Every piece is one surface (seam 2000) unless it is ropes whose gaps must show: each rope is then its own part, so
 * the painter's crevice falls where one passes over another and the ground between them, and the beads along a rope
 * (the plait) are its own form, lit on top and dark under, so they alternate light and dark at any density.
 */
export const HAIR_SEAM = 2000
/** The tag on the hair's top surface over the crown: where anything worn up on the head lies. */
export const CROWN = 'crown'
/** Each finish's light: how far the key reaches down its form (paint.ts thresholds: the light on its crests, a shadow
 * side), and whether it is matte (no glint, and its lit tone a step up in the shadow too, so a plait's beads, a loc's
 * edge, a coil's specks read on the dark side as well). */
const FINISH: Record<
  'coil' | 'braid' | 'smooth' | 'curl',
  { tones: [number, number, number]; matte: boolean }
> = {
  // Tight coils: mostly mid, the light on the crests.
  coil: { tones: [0.8, 0.3, -0.4], matte: true },
  // Braids: the light a rare crest and a deep shadow side, so the beads and the ropes carry the form.
  braid: { tones: [0.9, 0.2, -0.8], matte: true },
  // Straight hair (a low pony, a fall): the key's gloss reaching well down the form, the sheen band on.
  smooth: { tones: [0.6, 0.15, -0.55], matte: false },
  // Curls: the light on each clump's crest, matte.
  curl: { tones: [0.85, 0.25, -0.5], matte: true },
}
/** The finishes a fork registers (registerFinish), by name. Empty in base. */
const FINISHES = new Map<string, HairFinish>()
/** Registers a hair finish (H4) under `name`, which a style's `finish` then names: how far the key reaches down its form
 * (`tones`, as FINISH's) and whether it is matte. A matte finish never takes the sheen band (finish()). Throws on a name
 * base or an earlier registration has taken. */
export function registerFinish(name: string, light: HairFinish): void {
  if (name in FINISH || FINISHES.has(name)) throw new Error(`hair finish ${name} is registered already`)
  FINISHES.set(name, light)
}
/** The hair styles a character names (library/hair.json): the generators' pieces and the finish they are painted with. */
export const HAIR_STYLES: Record<string, HairStyle> = hairSchema.parse(hairLibrary)
/** The texels a metre at twice the brand kit's density (paint.ts densityOf): the size the figures are judged at. */
export const PPM = 73.8
/** A feature `want` metres across, held to whole texels at `ppm` (at least `least` of them). */
export const texels = (want: number, ppm: number, least = 1) => Math.max(least, Math.round(want * ppm)) / ppm
/** A piece's material in a tone: the swatch's colour alone (its hue ramp; its own light and gloss are the brows' and a
 * lock's), lit as the style's finish (FINISH), never with noise (the texture is the strands', beads' and coils' own
 * shapes); the fades, a run from the skin's own tones to the hair's; the scalp, the skin's own mid down its dark steps
 * (the ground between cornrows, lighter than the rows). */
export function finish(
  i: HairInput,
  f: Finish,
  tone: Tone,
  made: Record<string, Material>,
  matte = false,
): string {
  if (!['hair', 'lit', 'crest', 'fade1', 'fade2', 'scalp', 'parting'].includes(tone)) return tone
  const light = (FINISH as Record<string, HairFinish | undefined>)[f] ?? FINISHES.get(f)
  if (!light) throw new Error(`no finish ${f}`)
  const dull = matte || light.matte,
    name = `${i.hair}@${tone}:${f}${dull ? '~matte' : ''}`
  if (made[name]) return name
  const sw = i.swatch(i.hair),
    skin = i.swatch(i.skin)
  const p = sw.paint ?? tonesOf(sw).map(hexOf),
    hair: Material = {
      ramp: sw.ramp,
      base: sw.base,
      paint: p,
      tones: light.tones,
      ...(dull ? {} : { sheen: true }),
    }
  if (tone === 'hair') {
    made[name] = hair
    return name
  }
  // The lit tone: the hair's light and mid each a step up (the light raised along its DUEL row, so the sheen keeps its
  // hue), its shadow and deep the hair's own, so a streak shows where the light is and the shadow stays quiet; matte,
  // its shadow a step up too (the next lighter of the hair's own: black's two darks are one), so a plait, a loc's edge,
  // a coil's specks read down the dark side.
  const up = (q: number) =>
    p
      .slice(0, q)
      .reverse()
      .find((c) => c !== p[q]) ?? raise(p[q])
  // The designed tones (a lit streak, a crest, a parting) are the style's own light: no sheen band laid over them.
  if (tone === 'lit') {
    made[name] = {
      ...hair,
      sheen: undefined,
      paint: dull ? [raise(p[0]), up(1), up(2), p[3]] : [raise(p[0]), p[0], p[2], p[3]],
    }
    return name
  }
  // The crest: the lit tone with the light reaching further down the form, so a plane facing up (a high-top's flat top)
  // takes the light whole, one crisp tone against the coils of its sides.
  if (tone === 'crest') {
    made[name] = {
      ...hair,
      sheen: undefined,
      tones: [0.45, 0.05, -0.5],
      paint: [raise(p[0]), p[0], p[1], p[2]],
    }
    return name
  }
  if (tone === 'parting') {
    made[name] = { ...hair, sheen: undefined, paint: [p[3], p[3], p[3], p[3]] }
    return name
  }
  if (tone === 'scalp') {
    const t = tonesOf(skin)
    made[name] = { ...skin, gloss: undefined, paint: [t[1], t[2], t[3], t[3]].map(hexOf) }
    return name
  }
  // A fade's tier names its two ends, the hair's tones and the skin's a step darker, for the painter to mix (paint.ts
  // mixTones: tone by tone, in OKLab, in the skin's hue), so the run is never a grey or a mauve between them and stays in
  // order, light to deep, whatever the hair's colour against the skin's: `fade1` (nearer the hair) 0.3 of the way to the
  // skin, `fade2` (nearer the skin) 0.6.
  const sr = tonesOf(skin).map(hexOf)
  made[name] = {
    ...skin,
    gloss: undefined,
    paint: undefined,
    mix: {
      from: tonesOf(hair).map(hexOf),
      to: [sr[1], sr[2], sr[3], sr[3]],
      at: tone === 'fade1' ? 0.3 : 0.6,
    },
  }
  return name
}
/** A DUEL colour a step up its ramp. */
function raise(hex: string) {
  const c = parseInt(hex.slice(1), 16)
  for (const row of RAMPS) {
    const i = row.indexOf(c)
    if (i >= 0) return hexOf(row[Math.min(7, i + 1)])
  }
  return hex
}
/** The hair pieces a fork registers (registerHairPiece), by kind. Empty in base. */
export const PIECES = new Map<string, HairPiece>()
/** Registers a hair piece under `kind`, the key a style's piece carries ({ bun: {…} }). Throws on a name taken, the
 * generators' (scalp, rows, tail) included. */
export function registerHairPiece(kind: string, p: HairPiece): void {
  if (['scalp', 'rows', 'tail', 'bun', 'fall', 'fringe'].includes(kind) || PIECES.has(kind))
    throw new Error(`hair piece ${kind} is registered already`)
  PIECES.set(kind, p)
}

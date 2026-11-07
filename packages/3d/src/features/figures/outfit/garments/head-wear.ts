// The garments worn on the head and face: hair, caps and the face's marks. They are classic kinds like the rest
// (classic-kinds.ts registers them), but each draws from the libraries rather than from the body's rings, so they
// live apart from classic.ts.
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/garments.ts at a1f7246 (`dress`'s hair,
// cap and eyes branches), with AF's strict types; the order of the parts is the source's. Changed: a hair garment
// with no style wears the figure's `hairPieces` (M3.5b decision 6).

import type { V3 } from '../../../../shared/math/math.ts'
import { GROUP } from '../../body/mesh.ts'
import { J } from '../../body/rig.ts'
import type { HairStyle } from '../../content/hair.schema.ts'
import type { Lock } from '../../content/headwear.schema.ts'
import type { CapGarment, Eyes, HairGarment } from '../../figure/garment.schema.ts'
import { GARMENT_DEFAULTS } from '../../figure/garment-defaults.ts'
import { capParts, underCap } from '../../hair/cap.ts'
import { hairParts } from '../../hair/hair-parts.ts'
import { HAIR_SEAM } from '../../hair/skull.ts'
import { outfitHooks } from '../../registry/outfit-hooks-registry.ts'
import { body } from './body.ts'
import type { Dressing } from './classic.ts'
import { face } from './face.ts'
import { FACE_SEAM } from './head.ts'
import { box, lockParts, named } from './locks.ts'

/** The hair styles a hair garment wears: its own, or with none, the figure's `hairPieces`. */
function stylesOf(item: HairGarment, d: Dressing): HairStyle[] {
  const toStyle = (style: string | HairStyle | readonly Lock[]): HairStyle =>
    typeof style === 'string'
      ? named(d.wardrobe.hair, 'hair style', style)
      : Array.isArray(style)
        ? { locks: style }
        : (style as HairStyle)
  if (item.style !== undefined) return [toStyle(item.style)]
  if (!d.hairPieces?.length)
    throw new Error(`a hair garment with no style wears the figure's hairPieces, and this figure has none`)
  return d.hairPieces.map(toStyle)
}

/** The hair: the generators' pieces, or rounded locks, one surface; pressed inside a cap's dome when one is worn. */
export function wearHair(d: Dressing, item: HairGarment): void {
  const { m, s, r, garments, parts, decals, wardrobe, made } = d
  for (const style of stylesOf(item, d)) {
    if (style.pieces) {
      const hat = garments.find((x): x is CapGarment => 'cap' in x)
      const cap = hat && named(wardrobe.headwear, 'headwear', hat.style as string).cap
      // The tie in the wearer's own palette: the one it names, else the one the outfit hooks pick, else the
      // outfit's metal, else a band of the hair's own. The trunk the hair falls clear of: the tops worn by now over the body's own torso.
      const tie =
        item.tie ??
        outfitHooks().tie?.(garments, wardrobe.swatches) ??
        garments
          .flatMap((x) => Object.values(x))
          .find((v): v is string => typeof v === 'string' && wardrobe.swatches[v]?.kind === 'metal')
      const trunk = [...parts, ...body(m, s, r, d.thighs, {})].filter((p) => p.group === GROUP.torso)
      const hair = hairParts(
        { m, s, hair: item.hair, skin: r.skin, made, capped: !!hat, tie, trunk },
        { about: style.about, pieces: style.pieces, finish: style.finish },
      )
      // Under a cap the hair is pressed inside its dome, so no style stands through it.
      parts.push(...(cap ? underCap(m, s, cap, hair.parts) : hair.parts))
      decals.push(...hair.decals)
    }
    if (style.locks)
      parts.push(
        ...lockParts(s, m.k, item.hair, GROUP.hair, style.locks).map((p) => ({ ...p, seam: HAIR_SEAM })),
      )
  }
}

/** A cap: its dome, its locks and its mark. */
export function wearCap(d: Dressing, item: CapGarment): void {
  const { m, s, parts, decals, wardrobe, made } = d
  const g = s.genes
  const k = m.k
  const hw = (g.head * g.headWidth) / 2
  const hd = (g.head * g.headDepth) / 2
  const h = g.head
  const headwear = named(wardrobe.headwear, 'headwear', item.style as string)
  if (headwear.cap) {
    const cap = capParts(m, s, item.cap, headwear.cap, made, item.mark)
    parts.push(...cap.parts)
    decals.push(...cap.decals)
  }
  if (headwear.locks) parts.push(...lockParts(s, k, item.cap, GROUP.hair, headwear.locks))
  const mark = item.mark
  if (mark && headwear.mark) {
    const { at, atk = [0, 0, 0], normal, sizes } = headwear.mark
    const place: V3 = [hw * at[0] + k * atk[0], h * at[1] + k * atk[1], hd * at[2] + k * atk[2]]
    for (const size of sizes ?? [undefined])
      decals.push({
        bone: J.head,
        at: place,
        normal: [...normal],
        material: mark,
        ...(size ? { size: [...size] } : {}),
      })
  }
}

/** The face's marks: the eyes with their lids, brows and mouth, and a stubble. */
export function wearEyes(d: Dressing, item: Eyes): void {
  const { s, parts, decals } = d
  const g = s.genes
  const hw = (g.head * g.headWidth) / 2
  const hd = (g.head * g.headDepth) / 2
  const h = g.head
  const { lids, brows, mouth } = GARMENT_DEFAULTS.eyes
  decals.push(...face(s, item.eyes, item.lids ?? lids, item.brows ?? brows, item.mouth ?? mouth))
  if (item.stubble)
    parts.push(
      box(
        J.head,
        item.stubble,
        GROUP.head,
        { at: [0, h * 0.12, hd * 0.52], r: [hw * 0.72, h * 0.12, hd * 0.5], e: [0.6, 0.65], taper: [0.7, 1] },
        { seam: FACE_SEAM },
      ),
    )
}

// The wardrobe fits: every runway model, in the clothes of `RUNWAY_CAST`, on the slider extremes (thin, heavy, muscular, curvy,
// short), in the front and the three-quarter-back direction at D2, builds and paints, and no skin shows through its cloth.
// FigureBuilder's showcase drew that by eye (`fit-check`). Here it is two counts against the same body bare. (1) Of the texels
// the bare body paints in its skin's own colours, the share that is still skin once dressed (a face, hands, a neck, shins below
// a skirt) must not grow on any body past what the same model shows on its own. (2) The cloth stays a layer: the dressed
// silhouette is larger than the bare one, by a share of what it is on the model's own body. A garment repaints the body regions it
// covers in its own swatch, so skin cannot show through a shell, and a shell that stops clearing the body shows as (2): it loses
// its layer. The cells of the eight models on their own bodies, byte for byte, are held by the showcase's golden
// (`showcase-cells.test.ts`), which is what catches a clearance that moves.
import { describe, expect, it } from 'vitest'
import { registerFashion } from '#src/features/fashion/register-fashion.ts'
import { RUNWAY_CAST } from '#src/features/fashion/runway-cast.ts'
import { FASHION_SWATCHES } from '#src/features/fashion/swatches.ts'
import { BASE, type CharacterDef, cellOf, Figure, member, SWATCHES } from '#src/shared/figures/door.ts'
import { RUNWAY_GOLDEN } from '../../fixtures/runway-golden.ts'

registerFashion()

const PITCH = (18 * Math.PI) / 180
/** The model's own body, then the showcase's slider extremes (the golden's, so this and the golden dress the same bodies). */
const BODIES: readonly (readonly [string, Record<string, number>])[] = [
  ['own', {}],
  ...Object.entries(RUNWAY_GOLDEN.bodies).map(([name, sliders]) => [name, { ...sliders }] as const),
]
const DIRECTIONS = RUNWAY_GOLDEN.fitDirections

/** How far the share of skin that still shows may rise above the model's own, on any body (measured: the most is 0.04). */
const SLACK = 0.06
/** On any body the cloth keeps at least this share of the layer it makes on the model's own body (measured: the least is about half). */
const KEPT = 0.4

const rgb = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16))

/** The painted cell of `def` standing in `direction`, at D2. */
function cell(def: CharacterDef, direction: number): Uint8ClampedArray {
  const figure = new Figure(member(def, 2))
  figure.update(1 / 60, {
    facing: (direction * Math.PI) / 4,
    moving: false,
    view: { azimuth: 0, pitch: PITCH },
  })
  return cellOf(figure).painted
}

/** The texels of a painted cell, and those in one of the skin's own colours (its swatch's four painted tones, which no cloth carries). */
function texels(def: CharacterDef, direction: number): { opaque: number; skin: number } {
  const tones = (SWATCHES[def.skin]?.paint ?? []).map(rgb)
  const pixels = cell(def, direction)
  let [opaque, skin] = [0, 0]
  for (let i = 0; i < pixels.length; i += 4) {
    if ((pixels[i + 3] ?? 0) === 0) continue
    opaque++
    if (tones.some(([r, g, b]) => r === pixels[i] && g === pixels[i + 1] && b === pixels[i + 2])) skin++
  }
  return { opaque, skin }
}

/** `def` on `body`, dressed as it is, or bare (its hair and eyes only). */
function on(def: CharacterDef, body: Record<string, number>, dressed: boolean): CharacterDef {
  const worn = def.outfits[def.default] ?? []
  return {
    ...def,
    sliders: { ...def.sliders, ...body },
    outfits: { [def.default]: dressed ? worn : worn.filter((g) => 'hair' in g || 'eyes' in g) },
  }
}

describe('the runway wardrobe fits every body', () => {
  for (const { def } of RUNWAY_CAST) {
    for (const direction of DIRECTIONS) {
      it(`${def.id}, direction ${direction}: on ${BODIES.length} bodies, no more skin shows than on its own and the cloth is a layer`, () => {
        const shown = BODIES.map(([name, body]) => {
          const bare = texels(on(def, body, false), direction)
          const worn = texels(on(def, body, true), direction)
          return { name, bare, worn, share: worn.skin / bare.skin, layer: worn.opaque / bare.opaque - 1 }
        })
        const own = shown[0]
        if (own === undefined) throw new Error('no own body')
        for (const r of shown) {
          // The skin count means something only where the bare body is mostly skin, and a garment covers some of it.
          expect(r.bare.skin, `${def.id} on ${r.name}: the bare body's skin texels`).toBeGreaterThan(1000)
          expect(r.share, `${def.id} on ${r.name}: some of the skin is covered`).toBeLessThan(0.5)
          expect(
            r.share,
            `${def.id} on ${r.name}: skin share vs its own body's ${own.share.toFixed(3)}`,
          ).toBeLessThanOrEqual(own.share + SLACK)
          expect(r.layer, `${def.id} on ${r.name}: the cloth's layer over the bare body`).toBeGreaterThan(
            0.01,
          )
          expect(r.layer, `${def.id} on ${r.name}: the layer against its own body's`).toBeGreaterThanOrEqual(
            KEPT * own.layer,
          )
        }
      }, 60_000)
    }
  }

  it('lays a fabric on a tee in each of the seven, and the painter keeps its weave', () => {
    const named = Object.entries(FASHION_SWATCHES).filter(([, swatch]) => swatch.fabric !== undefined)
    expect(new Set(named.map(([, swatch]) => swatch.fabric)).size).toBe(7)
    const seen = new Set<string>()
    for (const [name, swatch] of named) {
      if (swatch.fabric === undefined || seen.has(swatch.fabric)) continue
      seen.add(swatch.fabric)
      const base = BASE[0]?.def as CharacterDef
      const def: CharacterDef = {
        ...base,
        id: `weave-${swatch.fabric}`,
        default: 'weave',
        outfits: { weave: [{ tee: name }] },
      }
      const figure = new Figure(member(def, 2))
      figure.update(1 / 60, { facing: 0, moving: false, view: { azimuth: 0, pitch: PITCH } })
      expect(cellOf(figure).weave, `${swatch.fabric} on ${name}`).not.toBeNull()
    }
  })
})

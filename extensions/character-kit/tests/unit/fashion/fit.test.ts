// The wardrobe fits: every runway outfit, on the slider extremes (thin, heavy, muscular, curvy, short), in the front and the
// three-quarter-back direction at D2, builds and paints, and its cloth stays a layer over the body. FigureBuilder's showcase drew
// this by eye (`fit-check`: skin through cloth). A garment repaints the body regions it covers in its own swatch, so skin never
// shows through; a shell that stops clearing a body loses its layer instead, and the painted silhouette falls back to the bare
// body's. That is what is counted here (against the same body bare); the gate's fit sheet (gate 2) is looked at for the rest.
import { describe, expect, it } from 'vitest'
import { registerFashion } from '#src/features/fashion/register-fashion.ts'
import { FASHION_SWATCHES } from '#src/features/fashion/swatches.ts'
import { BASE, type CharacterDef, cellOf, Figure, member } from '#src/shared/figure-builder/door.ts'
import { RUNWAY_OUTFITS } from '../../fixtures/runway-outfits.ts'

registerFashion()

const PITCH = (18 * Math.PI) / 180
const BODIES: readonly (readonly [string, Record<string, number>])[] = [
  ['default', {}],
  ['thin', { fat: 0, muscle: 0, frame: 0.5, height: 185, shoulders: 0, hips: 0 }],
  ['heavy', { fat: 1.2, muscle: 0.5, frame: 0.5, hips: 1.1, shoulders: 1, neck: 1 }],
  ['muscular', { fat: 0, muscle: 1, frame: 0, shoulders: 1, neck: 1 }],
  ['curvy', { fat: 0.7, frame: 1, bust: 1, seat: 1, hips: 1 }],
  ['short', { height: 150, legs: 0, fat: 0.5 }],
]
const DIRECTIONS = [0, 5] as const

/** The painted texels of the base woman on `body`, dressed in a runway outfit, or bare (the base pair's painted-on blocks). */
function painted(body: Record<string, number>, direction: number, outfit?: string): number {
  const base = BASE[1]?.def as CharacterDef
  const eyes = { eyes: 'eyeBrown', lids: 'lidDeep', white: 'eyeWhite', brows: 'hairBlack', lips: 'lipsBrown' }
  const def: CharacterDef = {
    ...base,
    id: `${outfit ?? 'bare'}-fit`,
    sliders: { ...base.sliders, ...body },
    ...(outfit === undefined
      ? {}
      : {
          default: 'runway',
          outfits: {
            runway: [...(RUNWAY_OUTFITS[outfit] ?? []), { hair: 'hairBlack', style: 'shortFade' }, eyes],
          },
        }),
  }
  const figure = new Figure(member(def, 2))
  figure.update(1 / 60, {
    facing: (direction * Math.PI) / 4,
    moving: false,
    view: { azimuth: 0, pitch: PITCH },
  })
  const cell = cellOf(figure)
  let n = 0
  for (let i = 3; i < cell.rgba.length; i += 4) if ((cell.rgba[i] ?? 0) > 0) n++
  return n
}

/** On any body the cloth keeps at least this share of the layer it makes on the default body (measured: the least is about half). */
const KEPT = 0.4

describe('the runway wardrobe fits every body', () => {
  for (const id of Object.keys(RUNWAY_OUTFITS)) {
    for (const direction of DIRECTIONS) {
      it(`${id}, direction ${direction}: builds and paints on all ${BODIES.length} bodies, a layer over each`, () => {
        const grown = BODIES.map(([name, body]) => ({
          name,
          painted: painted(body, direction, id),
          bare: painted(body, direction),
        }))
        const [reference] = grown
        if (reference === undefined) throw new Error('no default body')
        const layer = (r: { painted: number; bare: number }) => r.painted / r.bare - 1
        for (const r of grown) {
          expect(r.painted, `${id} on ${r.name}`).toBeGreaterThan(500)
          expect(layer(r), `${id} on ${r.name}: the cloth's layer over the bare body`).toBeGreaterThan(0.01)
          expect(layer(r), `${id} on ${r.name} against the default body`).toBeGreaterThanOrEqual(
            KEPT * layer(reference),
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

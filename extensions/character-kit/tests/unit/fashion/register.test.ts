import { describe, expect, it } from 'vitest'
import { FABRICS } from '#src/features/fashion/fabrics.ts'
import { FASHION_HAIR } from '#src/features/fashion/hair.ts'
import { registerFashion } from '#src/features/fashion/register-fashion.ts'
import { FASHION_SWATCHES } from '#src/features/fashion/swatches.ts'
import {
  BASE,
  type CharacterDef,
  cellOf,
  Figure,
  HAIR_STYLES,
  member,
  registerFabric,
  registerFinish,
  SWATCHES,
} from '#src/shared/figures/door.ts'

// Read before anything registers: the builder's own names.
const BUILDER_SWATCHES = new Set(Object.keys(SWATCHES))
const BUILDER_HAIR = new Set(Object.keys(HAIR_STYLES))

describe("the runway's fabrics, swatches and hair, on the builder's hooks", () => {
  it('has seven fabrics, and none of the kit’s names is one of the builder’s own', () => {
    expect(Object.keys(FABRICS)).toHaveLength(7)
    for (const name of Object.keys(FASHION_SWATCHES))
      expect(BUILDER_SWATCHES.has(name), `swatch ${name}`).toBe(false)
    for (const name of Object.keys(FASHION_HAIR))
      expect(BUILDER_HAIR.has(name), `hair style ${name}`).toBe(false)
  })

  it('hands every fabric to registerFabric, every swatch to SWATCHES and every style to HAIR_STYLES', () => {
    registerFashion()
    for (const [name, fabric] of Object.entries(FABRICS)) {
      // The builder refuses a fabric named twice: it is registered already, by the kit.
      expect(() => registerFabric(name, fabric), `fabric ${name}`).toThrow(/already registered/)
    }
    expect(() => registerFinish('silk', { tones: [0.6, 0.15, -0.55], matte: false })).toThrow(
      /registered already/,
    )
    for (const name of Object.keys(FASHION_SWATCHES)) expect(name in SWATCHES, `swatch ${name}`).toBe(true)
    for (const name of Object.keys(FASHION_HAIR)) expect(name in HAIR_STYLES, `hair style ${name}`).toBe(true)
  })

  it('can be asked twice (two games in one page) without the builder throwing', () => {
    expect(() => {
      registerFashion()
      registerFashion()
    }).not.toThrow()
  })

  it('paints a character whose hair has the silk finish', () => {
    registerFashion()
    const base = BASE[1]?.def as CharacterDef
    const def: CharacterDef = { ...base, id: 'silk-test', outfits: { ...base.outfits } }
    const outfit = def.default
    const garments = def.outfits[outfit] ?? []
    def.outfits[outfit] = [
      ...garments.filter((g) => !('hair' in g)),
      { hair: 'hairBlond', style: 'sleekPony' },
    ]
    const figure = new Figure(member(def, 2))
    figure.update(1 / 60, { facing: 0, moving: false, view: { azimuth: 0, pitch: (18 * Math.PI) / 180 } })
    const cell = cellOf(figure)
    expect(cell.rgba.some((v, i) => i % 4 === 3 && v > 0)).toBe(true)
  })
})

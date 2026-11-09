// The base pair (`@automata/3d/base`): one man and one woman in painted-on blocks, barefoot, built from the pair's own
// swatches and nothing else.
import { describe, expect, it } from 'vitest'
import { BASE_PAIR, BASE_PAIR_SWATCHES } from '#src/entries/base.ts'
import { GROUP } from '#src/features/figures/body/mesh.ts'
import { build } from '#src/features/figures/figure/build.ts'
import { figureSchema } from '#src/features/figures/figure/figure.schema.ts'
import { skeleton } from '#src/features/figures/figure/figure-skeleton.ts'

const library = { swatches: BASE_PAIR_SWATCHES, hair: {}, headwear: {}, items: {} }
const BODY = new Set<number>([
  GROUP.torso,
  GROUP.head,
  GROUP.hair,
  GROUP.armL,
  GROUP.armR,
  GROUP.legL,
  GROUP.legR,
])

describe('the base pair', () => {
  for (const [who, def] of Object.entries(BASE_PAIR)) {
    it(`${who} parses as a figure and builds`, () => {
      expect(figureSchema.safeParse(def).success).toBe(true)
      const built = build(def, skeleton(def), 'base', null, library)
      expect(built.parts.length).toBeGreaterThan(10)
    })
    it(`${who} wears nothing: only the body, the hair and the face, in swatches the pair brings`, () => {
      const built = build(def, skeleton(def), 'base', null, library)
      for (const p of built.parts) expect(BODY.has(p.group), `${p.material} in group ${p.group}`).toBe(true)
      expect(
        built.parts.some((p) => p.group === GROUP.skirt || p.group === GROUP.cape || p.group === GROUP.item),
      ).toBe(false)
      expect(built.parts.some((p) => p.tag === 'cuff')).toBe(false)
      for (const m of Object.keys(built.materials))
        expect(Object.keys(BASE_PAIR_SWATCHES).some((id) => m.startsWith(id))).toBe(true)
    })
  }
  it('are two different bodies', () => {
    const [man, woman] = [BASE_PAIR.man, BASE_PAIR.woman]
    expect(man.sliders.height).toBeGreaterThan(woman.sliders.height ?? 0)
    expect(man.skin).not.toBe(woman.skin)
  })
})

describe("the base pair's swatches carry the painter's paint and tones, as the painter's source has them", () => {
  it('skin, hair, eyes and lips', () => {
    const skinTones = [0.55, 0.04, -0.5]
    expect(BASE_PAIR_SWATCHES['skin-warm']).toMatchObject({
      ramp: 'wine',
      step: 5,
      paint: ['#edb67c', '#ce9770', '#bd7d64', '#a76057'],
      tones: skinTones,
    })
    expect(BASE_PAIR_SWATCHES['skin-brown']).toMatchObject({
      ramp: 'skin',
      step: 4,
      paint: ['#c7826c', '#ad6e51', '#885041', '#733d3b'],
      tones: skinTones,
    })
    expect(BASE_PAIR_SWATCHES['hair-black']?.paint).toEqual(['#23324d', '#181f2f', '#181f2f', '#181f2f'])
    expect(BASE_PAIR_SWATCHES['eye-brown']?.paint).toEqual(['#4a353c', '#1d1d21', '#1d1d21', '#000000'])
    expect(BASE_PAIR_SWATCHES['lips-warm']?.paint).toEqual(['#a76057', '#d28d7a', '#904647', '#904647'])
    expect(BASE_PAIR_SWATCHES['lips-brown']).toMatchObject({
      ramp: 'rust',
      step: 2,
      paint: ['#7c4b47', '#98595a', '#633432', '#633432'],
    })
  })
})

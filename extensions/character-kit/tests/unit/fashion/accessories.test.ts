// What the painted wardrobe must wear that the old figures wear and the runway's nine kinds do not: a waistcoat, stockings (`legs`),
// a belt, a cap, a boot's shaft, and a skirt's stain. The kit already had a waistcoat, `legs`, a belt and a mark, but only for
// core's mesh figures (`registerGarment` in `@automata/3d/figures`, a different kind shape), so a painted character that named
// one was refused and a game had to leave the clothes off. Each test dresses one figure with and without the piece and counts the
// texels of the piece's own colours in the painted cell: a piece the painter does not draw leaves none.
import { describe, expect, it, vi } from 'vitest'
import { HEADWEAR } from '#src/features/fashion/headwear.ts'
import { registerFashion } from '#src/features/fashion/register-fashion.ts'
import { FASHION_SWATCHES } from '#src/features/fashion/swatches.ts'
import { BASE, type CharacterDef, cellOf, Figure, type Material, member } from '#src/shared/figures/door.ts'

registerFashion()

const PITCH = (18 * Math.PI) / 180

/** A swatch of its own four painted colours, each one the painter's DUEL palette holds (it snaps every colour to it), so the swatch's texels are countable. */
const own = (paint: string[]): Material => ({ ramp: 10, base: 4, paint })
const SWATCHES = {
  vest: own(['#904647', '#6e2434', '#492129', '#2e1026']),
  stock: own(['#366b8a', '#25466b', '#23324d', '#181f2f']),
  strap: own(['#945d4f', '#784c49', '#583126', '#372423']),
  hat: own(['#f5f7fa', '#e1e5ea', '#a6aeba', '#828b98']),
  mud: own(['#98595a', '#7c4b47', '#633432', '#49251c']),
  boot: own(['#e8cb82', '#cca96e', '#b29062', '#7e6144']),
} as const

const HEAD = [{ eyes: 'eyeBrown' }, { hair: 'hairAuburn', style: 'smoothBob' }] as const

const rgb = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16))

/** How many texels of `swatch` the figure paints, summed over the four sides it can be seen from. */
function texelsOf(garments: CharacterDef['outfits'][string], swatch: keyof typeof SWATCHES): number {
  const def: CharacterDef = {
    ...(BASE[0] as { def: CharacterDef }).def,
    swatches: { ...FASHION_SWATCHES, ...SWATCHES },
    default: 'test',
    outfits: { test: [{ tee: 'ribCream', sleeves: 'short' }, ...garments, ...HEAD] },
  }
  const tones = (SWATCHES[swatch].paint ?? []).map(rgb)
  let count = 0
  for (const direction of [0, 2, 4, 6]) {
    const figure = new Figure(member(def, 2))
    figure.update(1 / 60, {
      facing: (direction * Math.PI) / 4,
      moving: false,
      view: { azimuth: 0, pitch: PITCH },
    })
    const pixels = cellOf(figure).painted
    for (let i = 0; i < pixels.length; i += 4) {
      if ((pixels[i + 3] ?? 0) === 0) continue
      if (tones.some(([r, g, b]) => r === pixels[i] && g === pixels[i + 1] && b === pixels[i + 2])) count++
    }
  }
  return count
}

/** How many more texels of `swatch` `with` paints than `without` does: the other cloths may share a DUEL colour, the piece adds its own. */
const added = (
  without: CharacterDef['outfits'][string],
  worn: CharacterDef['outfits'][string],
  swatch: keyof typeof SWATCHES,
): number => texelsOf(worn, swatch) - texelsOf(without, swatch)

// Each test builds a dozen figures at density 2, which takes a few seconds.
vi.setConfig({ testTimeout: 60_000 })

describe('the painted wardrobe wears the old figures’ pieces', () => {
  it('a waistcoat covers the chest in its cloth', () => {
    expect(added([{ jeans: 'denim' }], [{ waistcoat: 'vest' }, { jeans: 'denim' }], 'vest')).toBeGreaterThan(
      150,
    )
  })

  it('stockings paint the legs below a skirt', () => {
    const skirt = { skirt: 'navyWool', length: 0.45 }
    expect(added([skirt], [{ legs: 'stock' }, skirt], 'stock')).toBeGreaterThan(100)
  })

  it('a belt is a band round the waist, and its buckle shows in front', () => {
    const trousers = { jeans: 'denim' }
    expect(added([trousers], [trousers, { belt: 'strap' }], 'strap')).toBeGreaterThan(40)
    expect(added([trousers], [trousers, { belt: 'strap', buckle: 'hat' }], 'hat')).toBeGreaterThan(0)
  })

  it('a nurse’s cap sits on the head, and a cap names its style', () => {
    expect(added([], [{ cap: 'hat', style: 'nurse' }], 'hat')).toBeGreaterThan(20)
    expect(() => texelsOf([{ cap: 'hat', style: 'sombrero' }], 'hat')).toThrow(/headwear/)
  })

  it('a cap’s mark is drawn on it in the mark’s own colour', () => {
    expect(added([], [{ cap: 'hat', style: 'nurse', mark: 'strap' }], 'strap')).toBeGreaterThan(0)
  })

  it('a boot has a shaft up the shin that a shoe has not', () => {
    const trousers = { trousers: 'denim' }
    const shoe = [trousers, { shoes: 'boot', sole: 'stock' }]
    const boot = [trousers, { shoes: 'boot', sole: 'stock', boots: true }]
    expect(texelsOf(shoe, 'boot')).toBeGreaterThan(0)
    expect(added(shoe, boot, 'boot')).toBeGreaterThan(100)
  })

  it('a skirt takes a stain at its hem', () => {
    const skirt = { skirt: 'navyWool', length: 0.45 }
    expect(added([skirt], [{ ...skirt, stain: 'mud', stainHeight: 0.2 }], 'mud')).toBeGreaterThan(30)
  })

  it('a cap set on the brow is the nurse’s cap worn low and forward, painted and marked like it', () => {
    const [crown, brow] = [HEADWEAR.nurse, HEADWEAR.nurseBrow]
    expect(brow).toBeDefined()
    const [low, high] = [brow?.pieces[0]?.at, crown?.pieces[0]?.at]
    expect(low?.[1]).toBeLessThan(high?.[1] ?? 0)
    expect(low?.[2]).toBeGreaterThan(high?.[2] ?? 0)
    expect(brow?.mark).toBeDefined()
    expect(added([], [{ cap: 'hat', style: 'nurseBrow' }], 'hat')).toBeGreaterThan(20)
  })
})

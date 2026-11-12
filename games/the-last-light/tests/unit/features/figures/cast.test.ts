import { describe, expect, it } from 'vitest'
import { ADA, MISSING, NIGHT_NURSE, PLAY_FIGURE } from '#src/features/figures/cast.ts'

// The two painted figures of the night, as the old game's character files (`src/render/figure/characters/ada.json` and
// `nurse.json` at 92e6704) dressed from what the character kit has today. The old clothes the kit has no garment for are listed in
// `MISSING` and held until the wardrobe lands, so a missing piece is a line here and never a silent substitute.

const garmentKinds = (def: typeof ADA, outfit: string): string[] =>
  (def.outfits[outfit] ?? []).map((garment) => Object.keys(garment)[0] as string)

describe('Ada', () => {
  it('is the old Ada Voss: 1.62 m, in the street clothes the prologue puts her in', () => {
    expect(ADA.id).toBe('ada')
    expect(ADA.sliders.height).toBe(162)
    expect(ADA.default).toBe('street')
    expect(ADA.gait).toBe('brisk')
  })

  it('wears what the kit has of those: a knit tee, jeans, brown leather shoes, an auburn bob, brown eyes', () => {
    expect(garmentKinds(ADA, 'street')).toEqual(['tee', 'jeans', 'shoes', 'hair', 'eyes'])
    expect(ADA.outfits.street).toContainEqual({ hair: 'hairAuburn', style: 'smoothBob' })
  })
})

describe('the night nurse', () => {
  it('is the old figure: 2.1 m, tall, thin and long-armed, her head cocked', () => {
    expect(NIGHT_NURSE.id).toBe('nurse')
    expect(NIGHT_NURSE.sliders.height).toBe(210)
    expect(NIGHT_NURSE.sliders.headTilt).toBe(15)
    expect(NIGHT_NURSE.sliders.arms).toBeGreaterThan(0.9)
  })

  it('wears what the kit has of her uniform: a white short-sleeved tee, a white skirt, heavy shoes, long black hair', () => {
    expect(garmentKinds(NIGHT_NURSE, 'uniform')).toEqual(['tee', 'skirt', 'shoes', 'hair', 'eyes'])
    expect(NIGHT_NURSE.swatches).toHaveProperty('heavyShoe')
  })
})

describe('what the old figures wear that the kit has no garment for', () => {
  it('is named, each against the character and the old swatch or style', () => {
    expect(MISSING.ada.map((piece) => piece.old)).toEqual(['waistcoat maroon', 'boots (shaft and sole)'])
    expect(MISSING.nightNurse.map((piece) => piece.old)).toEqual([
      'stockings (stockingDark)',
      'belt (wardWhiteShade)',
      'nurse cap (capWhite, a cross)',
      'curtain hair over the face',
      'hem stain and folds on the skirt',
      'the uncanny gait',
    ])
    for (const piece of [...MISSING.ada, ...MISSING.nightNurse]) expect(piece.why.length).toBeGreaterThan(10)
  })
})

describe('how a figure is painted in play', () => {
  it('is the old game’s: density 1 (about 37 texels a metre) at true size, so the camera’s 52 lines a metre make a 1.62 m Ada about 85 lines tall', () => {
    expect(PLAY_FIGURE).toEqual({ density: 1, crisp: false })
  })
})

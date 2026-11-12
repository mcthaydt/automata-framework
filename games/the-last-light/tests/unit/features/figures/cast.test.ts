import { paintedCell, texelsOfSwatch } from '@automata/character-kit/testing'
import { describe, expect, it } from 'vitest'
import { ADA, HELD, NIGHT_NURSE, PLAY_FIGURE } from '#src/features/figures/cast.ts'

// The two painted figures of the night, as the old game's character files (`src/render/figure/characters/ada.json` and
// `nurse.json` at 92e6704) dress them, piece for piece. The old outfits are copied below as the old files have them; the only
// differences are the two named in `HELD` (and the three it names for the figure's cloth), and each is a line there and never a
// silent substitute.

/** The old `ada.json`'s `street` outfit, as written: what the prologue puts her in (`story.scenes.prologue`). */
const OLD_STREET = [
  { top: 'cream', sleeves: 'short' },
  { waistcoat: 'maroon' },
  { trousers: 'denim' },
  { shoes: 'bootBrown', sole: 'bootSole', boots: true },
  { hair: 'auburn', style: 'bob' },
  { eyes: 'eyeDark' },
]

/** The old `nurse.json`'s `uniform` outfit, as written. */
const OLD_UNIFORM = [
  { top: 'wardWhite', sleeves: 'short' },
  { skirt: 'wardWhite', length: 0.42, flare: 0.3, folds: 0.08, stain: 'stain', stainHeight: 0.19 },
  { legs: 'stockingDark' },
  { shoes: 'heavyShoe' },
  { belt: 'wardWhiteShade' },
  { hair: 'inkBlack', style: 'curtain' },
  { cap: 'capWhite', style: 'nurse', mark: 'cross' },
]

/** What `HELD` replaces in an old outfit, by item, so the comparison names each difference. */
const asDrawn = (old: readonly Record<string, unknown>[]) =>
  old.map((item) => {
    if (item.style === 'bob') return { ...item, style: 'smoothBob' }
    if (item.style === 'curtain') return { ...item, style: 'fallLong' }
    if ('folds' in item) {
      const { folds: _folds, ...rest } = item
      return rest
    }
    return item
  })

describe('Ada', () => {
  it('is the old Ada Voss: 1.62 m, fair, brisk, in the street clothes the prologue puts her in', () => {
    expect(ADA.id).toBe('ada')
    expect(ADA.sliders.height).toBe(162)
    expect(ADA.default).toBe('street')
    expect(ADA.skin).toBe('fair')
    expect(ADA.gait).toBe('brisk')
    expect(ADA.gaitOverrides).toEqual({
      armOut: 0.11,
      idleElbow: 0.15,
      hang: 0.04,
      stance: 0,
      stanceLead: 0,
      shift: 0,
    })
  })

  it('wears the old `street` outfit piece for piece: a cream top, a maroon waistcoat, denim, boots, an auburn bob', () => {
    expect(ADA.outfits.street).toEqual(asDrawn(OLD_STREET))
  })

  it('has the old swatches of every cloth she wears, by their old names', () => {
    for (const name of ['cream', 'maroon', 'denim', 'bootBrown', 'bootSole', 'auburn', 'eyeDark', 'fair'])
      expect(ADA.swatches, name).toHaveProperty(name)
  })
})

describe('the night nurse', () => {
  it('is the old figure: 2.1 m, tall, thin and long-armed, her head cocked', () => {
    expect(NIGHT_NURSE.id).toBe('nurse')
    expect(NIGHT_NURSE.sliders.height).toBe(210)
    expect(NIGHT_NURSE.sliders.headTilt).toBe(15)
    expect(NIGHT_NURSE.sliders.arms).toBeGreaterThan(0.9)
  })

  it('wears the old `uniform` piece for piece: a worn white top and skirt, dark stockings, a belt, a nurse’s cap with its cross', () => {
    expect(NIGHT_NURSE.outfits.uniform).toEqual(asDrawn(OLD_UNIFORM))
  })

  it('has the old swatches of every cloth she wears, by their old names', () => {
    for (const name of [
      'wardWhite',
      'wardWhiteShade',
      'stockingDark',
      'inkBlack',
      'capWhite',
      'cross',
      'heavyShoe',
      'stain',
      'pale',
    ])
      expect(NIGHT_NURSE.swatches, name).toHaveProperty(name)
  })
})

describe('the painted frame shows what they wear', () => {
  // The painter drops a garment it does not know without a word, so the proof is in the picture: the swatches' own colours, counted
  // in the cell seen from the front and from the back.
  const seen = (def: typeof ADA, swatch: string, density: 1 | 2 = 2) =>
    [0, 1, 2, 4].reduce(
      (sum, direction) => sum + texelsOfSwatch(def, paintedCell(def, direction, density), swatch),
      0,
    )

  it('shows Ada in a maroon waistcoat over her cream top, in brown boots', () => {
    expect(seen(ADA, 'maroon')).toBeGreaterThan(150)
    expect(seen(ADA, 'cream')).toBeGreaterThan(50)
    expect(seen(ADA, 'bootBrown')).toBeGreaterThan(80)
  })

  it('shows the night nurse in stained white, dark stockings, a belt and a cap with its cross', () => {
    for (const swatch of ['wardWhite', 'stockingDark', 'wardWhiteShade', 'capWhite', 'stain'])
      expect(seen(NIGHT_NURSE, swatch), swatch).toBeGreaterThan(0)
    // The cross is a mark of a few texels, drawn at the play density (1), not at the close-up ones.
    expect(seen(NIGHT_NURSE, 'cross', 1)).toBeGreaterThan(0)
  })
}, 60_000)

describe('what the old figures do that the painter cannot yet', () => {
  it('is named, each against the character and what the figure shows instead', () => {
    expect(HELD.map((piece) => piece.old)).toEqual([
      'the nurse’s curtain hair over her face',
      'the folds of the nurse’s skirt',
      'the nurse’s uncanny gait',
      'Ada’s own bob (the old `bob` style)',
    ])
    for (const piece of HELD) {
      expect(piece.why.length).toBeGreaterThan(10)
      expect(piece.instead.length).toBeGreaterThan(3)
    }
  })
})

describe('how a figure is painted in play', () => {
  it('is the old game’s: density 1 (about 37 texels a metre) at true size, so the camera’s 52 lines a metre make a 1.62 m Ada about 85 lines tall', () => {
    expect(PLAY_FIGURE).toEqual({ density: 1, crisp: false })
  })
})

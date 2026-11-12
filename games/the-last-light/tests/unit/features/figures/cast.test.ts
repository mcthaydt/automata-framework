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

/** The old `ada.json`'s sliders, as written. Some mean something else in the painter now (`genes.ts` changed its ranges), so the figure keeps
 *  the old numbers except where `RETUNED_ADA` says, each chosen by what the figure looks like against the old game's own pictures. */
const OLD_ADA_SLIDERS = {
  frame: 0.85,
  height: 162,
  muscle: 0.5,
  fat: 0.2,
  shoulders: 0.47,
  hips: 0.37,
  legs: 0.3,
  arms: 0.15,
  head: 0.87,
  neck: 0.5,
  neckLength: 0.2,
  hands: 0.5,
  feet: 0.6,
  posture: 0.85,
  age: 0.25,
  headTilt: 0,
  chunk: 0.6,
}

/** Where Ada's sliders depart from the old file (round 1 of the figures' look): the old body is leaner on the page than the same numbers
 *  draw now, because the painter's `chunk` and clothing grew. */
const RETUNED_ADA = { fat: 0.05, hips: 0.2, legs: 0.6, chunk: 0.2, muscle: 0.3, shoulders: 0.55 }

/** The old `brisk` gait whole (`library/gaits.json` at 92e6704): the builder's own `brisk` is a tamer walk (lean 0.04, hipYaw 0.1, crouch 0.008). */
const OLD_BRISK = {
  cycle: 0.5,
  speed: 3,
  stride: 0.62,
  duty: 0.55,
  lift: 0.09,
  bob: 0.03,
  crouch: 0.04,
  sway: 0.02,
  hipYaw: 0.18,
  hipRoll: 0.05,
  chestCounter: 0.6,
  lean: 0.12,
  armSwing: 0.4,
  armOut: 0.13,
  elbow: 0.25,
  elbowSwing: 0.5,
  armLag: 0,
  headLevel: 0,
  headStabilize: 0.8,
  drag: 0,
  track: 0.7,
  twitch: 0,
  twitchEvery: 3,
  idlePoses: 8,
  stance: 0.04,
  stanceLead: 0.08,
  hang: 0.12,
  idleElbow: 0.45,
}

/** The old `uncanny` gait whole: the nurse's slow, dragging, head-leading walk and her arms' stiffness. */
const OLD_UNCANNY = {
  cycle: 0.8,
  speed: 1.05,
  stride: 0.5,
  duty: 0.62,
  lift: 0.04,
  bob: 0.028,
  crouch: 0.015,
  sway: 0.03,
  hipYaw: 0.05,
  hipRoll: 0.04,
  chestCounter: 0.15,
  lean: 0,
  armSwing: 0.04,
  armOut: 0.2,
  elbow: 0.04,
  elbowSwing: 0,
  armLag: 0.3,
  headLevel: 1,
  headStabilize: 1,
  drag: 0.6,
  track: 0.45,
  poseRate: 8,
  walkPoses: 6,
  turnRate: 0.39269908169872414,
  headLead: 1.8849555921538759,
  twitch: 0.38,
  twitchEvery: 3,
  breath: 0,
  breathPeriod: 6,
  shift: 0,
  shiftPeriod: 7,
  reach: 2.4,
  idleLoop: 6,
  idlePoses: 12,
  shuffle: false,
  stance: 0,
  stanceLead: 0,
  hang: -0.04,
  idleElbow: 0,
}

/** What `HELD` replaces in an old outfit, by item, so the comparison names each difference. */
const asDrawn = (old: readonly Record<string, unknown>[]) =>
  old.map((item) => {
    if (item.style === 'bob') return { ...item, style: 'smoothBob' }
    if (item.style === 'curtain') return { ...item, style: 'fallLong' }
    // The kit's `trousers` is a cloth shell grown over the whole leg; the old trousers were paint on the body's own leg. `jeans` is the kit's
    // closer cut (one clearance, a straighter knee), tapered to the ankle, as a slim leg is.
    if ('trousers' in item) return { jeans: item.trousers, taper: 0.7 }
    // The old waistcoat was a cropped box on the chest; the kit's follows the torso: fitted at the waist, ending at it, hung from straps.
    if ('waistcoat' in item) return { ...item, fit: 1, length: 0.05, armhole: 1 }
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
  })

  it('keeps the old sliders but for the ones retuned by what the figure looks like', () => {
    expect(ADA.sliders).toEqual({ ...OLD_ADA_SLIDERS, ...RETUNED_ADA })
  })

  it('walks the old brisk walk whole, with the old file’s own overrides on it, not the builder’s tamer `brisk`', () => {
    expect(ADA.gait).toBe('brisk')
    // The old `standOut` did not exist: her arms hung at `armOut` standing too, so it is that number.
    expect(ADA.gaitOverrides).toEqual({
      ...OLD_BRISK,
      armOut: 0.11,
      idleElbow: 0.15,
      hang: 0.04,
      stance: 0,
      stanceLead: 0,
      shift: 0,
      standOut: 0.11,
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

  it('walks the old uncanny gait whole (slow, dragging, the head leading), her arms kept close as the builder’s `loose` hangs them', () => {
    expect(NIGHT_NURSE.gait).toBe('loose')
    expect(NIGHT_NURSE.gaitOverrides).toEqual({ ...OLD_UNCANNY, armOut: 0.09, standOut: 0, standElbow: 0.04 })
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
      'the nurse’s stoop',
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

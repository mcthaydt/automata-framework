import {
  paintedCell,
  proportions,
  rowGaps,
  rowWidths,
  silhouette,
  texelsOfSwatch,
} from '@automata/character-kit/testing'
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
const RETUNED_ADA = {
  fat: 0.05,
  hips: 1,
  legs: 0.3,
  chunk: 0.2,
  muscle: 0.3,
  shoulders: 0.55,
  height: 154,
  neckLength: 0.1,
}

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
    if (item.style === 'bob') return { ...item, style: 'bobFringeFull' }
    // The old curtain hung over her face and loose down her back: the kit's `curtainLoose` brings the hairline down to the mouth and fans the rest wide. Her cap sits flat on the brow.
    if (item.style === 'curtain') return { ...item, style: 'curtainLoose' }
    if (item.style === 'nurse') return { ...item, style: 'nurseBrow' }
    // The kit's `trousers` is a cloth shell grown over the whole leg; the old trousers were paint on the body's own leg. `jeans` is the kit's
    // closer cut (one clearance), cut to the leg's own narrowing at the ankle with the inside of each leg bare of clearance, so two legs
    // do not join into one block.
    if ('trousers' in item) return { jeans: item.trousers, taper: 1, gap: 1 }
    // The old waistcoat was a cropped box on the chest, open at the front on a shirt; the kit's follows the torso: fitted at the waist, ending
    // at it, hung from straps, standing open on a panel of the shirt from a lowered neckline to the hem.
    if ('waistcoat' in item)
      return { ...item, fit: 1, length: 0.05, armhole: 1, open: 1, chest: 0.4, hem: 0.3, neckline: 1 }
    if ('folds' in item) {
      const { folds: _folds, ...rest } = item
      return rest
    }
    return item
  })

describe('Ada', () => {
  it('is the old Ada Voss, fair, brisk, in the street clothes the prologue puts her in, drawn as tall as the old game drew her (1.54 m on the page for its 1.62)', () => {
    expect(ADA.id).toBe('ada')
    expect(ADA.sliders.height).toBe(154)
    expect(ADA.default).toBe('street')
    expect(ADA.skin).toBe('fair')
    expect(ADA.gait).toBe('brisk')
  })

  it('keeps the old sliders but for the ones retuned by what the figure looks like', () => {
    expect(ADA.sliders).toEqual({ ...OLD_ADA_SLIDERS, ...RETUNED_ADA })
  })

  it('has the old Ada’s proportions on the page: her height in rows, her head and her hips (the Owner prefers the old look)', () => {
    // Measured from the old game's review sheets (round0-proportions.txt): 59 and 61 rows tall, a head with its hair 13 and 17 rows, a hip row 18 and 20.
    const p = proportions(ADA, 1)
    expect(p.height).toBeGreaterThanOrEqual(59)
    expect(p.height).toBeLessThanOrEqual(63)
    expect(p.headRowsWithHair).toBeGreaterThanOrEqual(13)
    expect(p.hip).toBeLessThanOrEqual(20)
    expect(ADA.genes?.head).toBe(0.28)
    // The old figure's legs were half of her (29 and 30 rows of 59 and 61), not more.
    expect(p.legRows / p.height).toBeLessThanOrEqual(0.51)
  })

  it('walks the old brisk walk whole, with the old file’s own overrides on it, not the builder’s tamer `brisk`', () => {
    expect(ADA.gait).toBe('brisk')
    // The old file zeroed her stance (weight on a leg), shift and hang and cut her idle elbow to 0.15; the old brisk gait's own numbers
    // (0.04, 0.08, 0.012, hang 0.12, idleElbow 0.45) stand her on one hip with a bent, hung arm, as the old hand-painted atlas does, so
    // only her `armOut` stays. The old `standOut` did not exist: her arms hung at `armOut` standing too, so it is that number.
    expect(ADA.gaitOverrides).toEqual({ ...OLD_BRISK, armOut: 0.11, standOut: 0.11 })
  })

  it('has the old face but for the drawn one: at the size she is played the builder draws a lid line the fringe covers, its decal face two eyes', () => {
    expect(ADA.face).toEqual({ camera: 0.6, turn: 0.15, blink: 3.7, drawn: false })
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

/** The front view of `def` at the play size, with a test for its skin texels and its dark ones. */
function frontView(def: typeof ADA) {
  const cell = paintedCell(def, 0, 1)
  const [w, h] = cell.size
  const p = cell.painted
  const skin = (def.swatches?.[def.skin]?.paint ?? []).map((hex) =>
    [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)),
  )
  const isSkin = (i: number) =>
    skin.some(([r, g, b]) => r === p[i * 4] && g === p[i * 4 + 1] && b === p[i * 4 + 2])
  const dark = (i: number) =>
    (p[i * 4 + 3] ?? 0) > 0 &&
    0.3 * (p[i * 4] ?? 0) + 0.59 * (p[i * 4 + 1] ?? 0) + 0.11 * (p[i * 4 + 2] ?? 0) < 60
  return { w, h, isSkin, dark }
}

/** The eye pair in the front view of `def` at the play size: two dark texels 2 to 7 apart on one row, each with skin beside it. */
function eyePair(def: typeof ADA): { y: number; xs: [number, number] } | undefined {
  const { w, h, isSkin, dark } = frontView(def)
  for (let y = 0; y < h; y++)
    for (let a = 1; a < w - 1; a++)
      for (let b = a + 2; b <= a + 7 && b < w - 1; b++) {
        const [i, j] = [y * w + a, y * w + b]
        if (dark(i) && dark(j) && isSkin(i - 1) && isSkin(i + 1) && isSkin(j - 1) && isSkin(j + 1))
          return { y, xs: [a, b] }
      }
  return undefined
}

/** Whether the skin shows right above both eyes: a fringe that sits on the eye row reads as one dark brow band, not as eyes under a fringe. */
const eyesClearOfFringe = (def: typeof ADA): boolean => {
  const eyes = eyePair(def)
  if (eyes === undefined) return false
  const { w, isSkin } = frontView(def)
  return eyes.xs.every((x) => isSkin((eyes.y - 1) * w + x))
}

describe('the painted frame shows what they wear', () => {
  // The painter drops a garment it does not know without a word, so the proof is in the picture: the swatches' own colours, counted
  // in the cell seen from the front and from the back.
  const seen = (def: typeof ADA, swatch: string, density: 1 | 2 = 2) =>
    [0, 1, 2, 4].reduce(
      (sum, direction) => sum + texelsOfSwatch(def, paintedCell(def, direction, density), swatch),
      0,
    )

  it('shows Ada’s eyes from the front at the size she is played', () => {
    expect(eyePair(ADA)).toBeDefined()
  })

  it('shows the skin of her brow above each eye, so her fringe frames them and does not sit on them', () => {
    expect(eyesClearOfFringe(ADA)).toBe(true)
  })

  it('shows floor between Ada’s legs below the knee at the size she is played: two legs, not one block', () => {
    const cell = paintedCell(ADA, 0, 1)
    const { top, height } = silhouette(cell)
    const rows = rowGaps(cell).slice(top + Math.round(height * 0.7), top + Math.round(height * 0.92))
    expect(rows.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(8)
  })

  it('shows Ada’s waistcoat open: a strip of her cream shirt between its two maroon sides, not a slit', () => {
    const cell = paintedCell(ADA, 0, 1)
    const [w, h] = cell.size
    const is = (i: number, swatch: string) =>
      (ADA.swatches?.[swatch]?.paint ?? []).some((hex) =>
        [1, 3, 5].every((k, n) => cell.painted[i * 4 + n] === Number.parseInt(hex.slice(k, k + 2), 16)),
      )
    let between = 0
    for (let y = 0; y < h; y++) {
      const xs = [...Array(w).keys()].filter((x) => is(y * w + x, 'maroon'))
      const [first, last] = [xs[0] ?? 0, xs[xs.length - 1] ?? 0]
      for (let x = first + 1; x < last; x++) if (is(y * w + x, 'cream')) between++
    }
    expect(between).toBeGreaterThanOrEqual(30)
  })

  it('hides the night nurse’s face under her hair at the size she is played: a few texels of skin (the loose hair leaves her chin and neck) in the rows of her head, not a mask', () => {
    const cell = paintedCell(NIGHT_NURSE, 0, 1)
    const { top, height } = silhouette(cell)
    const head = { ...cell, painted: cell.painted.slice() }
    head.painted.fill(0, (top + Math.round(height * 0.16)) * cell.size[0] * 4)
    expect(texelsOfSwatch(NIGHT_NURSE, head, 'pale')).toBeLessThanOrEqual(10)
  })

  it('hangs the night nurse’s hair loose and wide down her back, not in a tied tail, and shows it beside her neck from the front', () => {
    const widest = (view: number, from: number, to: number) => {
      const cell = paintedCell(NIGHT_NURSE, view, 1)
      const { top } = silhouette(cell)
      const hair = rowWidths(cell, { def: NIGHT_NURSE, swatch: 'inkBlack' })
      return Math.max(...hair.slice(top + from, top + to))
    }
    // From behind, below the head: a tied tail is 3 texels wide there, the loose hair 16. From the front, down the sides of her face and neck:
    // the long fall alone is 11 wide (her head), the loose hair 17.
    expect(widest(4, 16, 26)).toBeGreaterThanOrEqual(12)
    expect(widest(0, 9, 20)).toBeGreaterThanOrEqual(15)
  })

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

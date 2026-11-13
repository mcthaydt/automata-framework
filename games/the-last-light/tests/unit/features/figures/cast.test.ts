import { BASE, type CharacterDef } from '@automata/character-kit'
import {
  paintedCell,
  proportions,
  rowGaps,
  rowWidths,
  SWATCHES,
  silhouette,
  texelsOfSwatch,
} from '@automata/character-kit/testing'
import { describe, expect, it } from 'vitest'
import { ADA, HELD, NIGHT_NURSE, PLAY_FIGURE } from '#src/features/figures/cast.ts'

// The two painted figures of the night, as the old game's character files (`src/render/figure/characters/ada.json` and
// `nurse.json` at 92e6704) dress them, piece for piece. The old outfits are copied below as the old files have them; the only
// differences are the two named in `HELD` (and the three it names for the figure's cloth), and each is a line there and never a
// silent substitute.

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
    if (item.style === 'bob') return { ...item, style: 'bobFringe' }
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
    // The builder's decal eye is one texel, two apart; the kit's `eyeMarks` draws the old figures' eyes: two tall, about four apart.
    if ('eyes' in item) return { eyeMarks: item.eyes }
    if ('folds' in item) {
      const { folds: _folds, ...rest } = item
      return rest
    }
    return item
  })

/** The painted colours of a swatch of `def`, as RGB triples. */
const coloursOf = (def: typeof ADA, swatch: string): number[][] =>
  (def.swatches?.[swatch]?.paint ?? SWATCHES[swatch]?.paint ?? []).map((hex) =>
    [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)),
  )

/** A reader of Ada's front view at density 2, the size her face is judged at (the painter's own reference for a face: a brow two texels thick,
 *  an eye with its white under a dark lid, a mouth), by the swatch each part is painted in. */
function faceAt2(def: typeof ADA) {
  const cell = paintedCell(def, 0, 2)
  const [w, h] = cell.size
  // The head's rows only: the DUEL palette shares colours between swatches (a lip's is a boot's), so the face is read where only a face is.
  const top = rowWidths(cell).findIndex((width) => width > 0)
  // The head with its hair and three rows more, so the window follows the head's own size (24 + 3 rows at six heads tall).
  const headRows = proportions(def, 2).headRowsWithHair
  const bottom = top + headRows + 3
  const is = (x: number, y: number, swatch: string): boolean => {
    if (x < 0 || y < top || x >= w || y >= bottom) return false
    const i = y * w + x
    return coloursOf(def, swatch).some(
      ([r, g, b]) =>
        r === cell.painted[i * 4] && g === cell.painted[i * 4 + 1] && b === cell.painted[i * 4 + 2],
    )
  }
  const skin = (x: number, y: number): boolean => is(x, y, def.skin)
  const all = (swatch: string): [number, number][] => {
    const found: [number, number][] = []
    for (let y = top; y < Math.min(h, bottom); y++)
      for (let x = 0; x < w; x++) if (is(x, y, swatch)) found.push([x, y])
    return found
  }
  return { cell, is, skin, all, headRows }
}

/** A row of the head, as a share of its rows with the hair (`at` 19 rows of 24 is 19 / 24), so the windows follow the head's size. */
const rowAt = (headRows: number, share: number): number => Math.round(headRows * share)

describe('Ada', () => {
  it('is Ada Voss, brisk, in the street clothes the prologue puts her in, a little under 1.6 m', () => {
    expect(ADA.id).toBe('ada')
    expect(ADA.default).toBe('street')
    expect(ADA.gait).toBe('brisk')
    expect(ADA.sliders.height).toBe(160)
  })

  it('has a warm peach skin: orange in hue, not the pink the old fair skin was', () => {
    const [r, g, b] = coloursOf(ADA, ADA.skin)[1] ?? [0, 0, 0]
    const hue = (60 * ((g ?? 0) - (b ?? 0))) / Math.max(1, (r ?? 0) - (b ?? 0))
    expect(hue).toBeGreaterThanOrEqual(18)
    expect(hue).toBeLessThanOrEqual(40)
  })

  it('has the painter’s clean slim build: each body slider within 0.3 of the base woman’s, no body slider pushed by an earlier round', () => {
    const base = (BASE[1] as { def: CharacterDef }).def.sliders as Record<string, unknown>
    for (const [key, value] of Object.entries(ADA.sliders as Record<string, unknown>)) {
      if (typeof value !== 'number' || key === 'height') continue
      // A slider the base woman leaves out (her seat, her thighs) is the painter's default, 0.5 (`DEFAULT_SLIDERS` in the figures' genes).
      // Her thighs alone may go 0.35 under it (the Owner, 2026-11-13: "maybe not hips but ass"): from behind her width is her two
      // thighs side by side, and 0.2 left her jeans 0.9 of her shoulders, at the edge of what was asked.
      const reach = key === 'thighs' ? 0.35 : 0.3
      expect(Math.abs(value - Number(base[key] ?? 0.5)), key).toBeLessThanOrEqual(reach)
    }
    expect(ADA.genes).toBeUndefined()
  })

  it('stands about as tall as the base woman at density 2, her legs about half of her', () => {
    const p = proportions(ADA, 2)
    const woman = proportions((BASE[1] as { def: CharacterDef }).def, 2)
    expect(p.height).toBeGreaterThanOrEqual(woman.height - 12)
    expect(p.height).toBeLessThanOrEqual(woman.height)
    expect(p.legRows / p.height).toBeLessThanOrEqual(0.52)
  })

  it('is about six heads tall at density 2, her features filling her face as the base woman’s do (the Owner, 2026-11-12: “go with what looks the best”)', () => {
    // Shot in play and painted at x10 at seven, six and five heads and between (`docs/superpowers/audits/2026-11-12-last-light-ada-frames/item2-*`):
    // the painter's features are one or two texels whatever the head's size, so a larger head spreads the same brows, eyes and mouth over an
    // emptier face. At six they fill it as base-f's do.
    const p = proportions(ADA, 2)
    expect(p.heads).toBeGreaterThanOrEqual(5.6)
    expect(p.heads).toBeLessThanOrEqual(6.4)
    expect(p.headRows).toBeGreaterThanOrEqual(20)
  })

  it('walks the old brisk walk whole, with the arms close to her body', () => {
    expect(ADA.gait).toBe('brisk')
    expect(ADA.gaitOverrides).toMatchObject({ ...OLD_BRISK, armOut: 0.03, standOut: 0.03, hang: 0.02 })
  })

  it('stands with her arms hanging loose at her sides, as the painter’s own `loose` stand hangs them (the Owner, 2026-11-13: “her arms being bent like that is odd”)', () => {
    // The old brisk gait stood her with the walk's elbow and the idle's on top (0.25 + 0.45 rad) and the arms hung forward 0.12: bent
    // and held out, about to draw. The painter's `loose` gait (the base woman's) stands at a 0.34 bend, hung 0.02 forward.
    expect(ADA.gaitOverrides?.standElbow).toBe(0.34)
    expect(ADA.gaitOverrides?.hang).toBe(0.02)
  })

  it('has a seat no wider than her shoulders, from the front and from behind (the Owner, 2026-11-13: “maybe not hips but ass”)', () => {
    for (const direction of [0, 4]) {
      const cell = paintedCell(ADA, direction, 2)
      const { top, height } = silhouette(cell)
      const band = (widths: number[], from: number, to: number) =>
        Math.max(...widths.slice(top + Math.round(height * from), top + Math.round(height * to) + 1))
      const shoulders = band(rowWidths(cell, { def: ADA, swatch: 'cream' }), 0.16, 0.3)
      const seat = band(rowWidths(cell, { def: ADA, swatch: 'fadedDenim' }), 0.42, 0.62)
      expect(seat, `direction ${direction}`).toBeLessThanOrEqual(shoulders)
    }
  })

  it('is narrower through the hips and thighs than at the shoulders from behind, as the base man in her clothes is (the Owner, 2026-11-13: “maybe not hips but ass”)', () => {
    // At the painter's default thighs her jeans were as wide as her shirt at the shoulders from behind (30 and 30 at density 2); the
    // base man in her clothes is 0.79. Her thighs slider takes her to about 0.87, still a woman's build and not a man's.
    for (const direction of [4, 3]) {
      const cell = paintedCell(ADA, direction, 2)
      const { top, height } = silhouette(cell)
      const band = (widths: number[], from: number, to: number) =>
        Math.max(...widths.slice(top + Math.round(height * from), top + Math.round(height * to) + 1))
      const shoulders = band(rowWidths(cell, { def: ADA, swatch: 'cream' }), 0.16, 0.3)
      const seat = band(rowWidths(cell, { def: ADA, swatch: 'fadedDenim' }), 0.42, 0.62)
      expect(seat / shoulders, `direction ${direction}: ${seat} / ${shoulders}`).toBeLessThanOrEqual(0.9)
      expect(seat / shoulders, `direction ${direction}: ${seat} / ${shoulders}`).toBeGreaterThanOrEqual(0.8)
    }
  })

  it('has a drawn face at every density, which is the painter’s own: no decal dots', () => {
    expect(ADA.face?.drawn).toBe(true)
    const street = ADA.outfits.street as readonly Record<string, unknown>[]
    expect(street.some((item) => 'eyeMarks' in item)).toBe(false)
    expect(street.at(-1)).toMatchObject({
      eyes: 'eyeBrown',
      lids: 'lidDeep',
      white: 'eyeWhite',
      brows: 'hairBlack',
      lips: 'lipsAda',
    })
  })

  it('wears the generated images’ outfit: a shirt with a collar and rolled sleeves, an open oxblood waistcoat with brass buttons, faded jeans cropped and turned up, tan ankle boots, the painter’s auburn bob with its fringe', () => {
    const street = ADA.outfits.street as readonly Record<string, unknown>[]
    expect(street.map((item) => Object.keys(item)[0])).toEqual([
      'shirt',
      'waistcoat',
      'jeans',
      'shoes',
      'hair',
      'eyes',
    ])
    expect(street[0]).toMatchObject({ shirt: 'cream', sleeves: 'rolled', collar: 'collarLinen' })
    expect(street[1]).toMatchObject({ waistcoat: 'oxblood', open: 1, buttons: 'brass' })
    expect(street[2]).toMatchObject({ jeans: 'fadedDenim', crop: 0.3, turn: 'denimTurn', taper: 1 })
    expect(street[3]).toMatchObject({ shoes: 'bootBrown', boots: true, heel: 1, toe: 'bootToe' })
    expect(street[4]).toEqual({ hair: 'ashBrown', style: 'bobOpen' })
  })

  it('has the swatches of every cloth she wears: her shirt, boots, hair and skin, the look’s for the rest; her brows and lids are the painter’s own', () => {
    for (const name of [
      'cream',
      'bootBrown',
      'bootSole',
      'ashBrown',
      ADA.skin,
      'collarLinen',
      'cuffLinen',
      'oxblood',
      'brass',
      'fadedDenim',
      'denimTurn',
      'denimBand',
      'bootToe',
    ])
      expect(ADA.swatches?.[name] ?? SWATCHES[name], name).toBeDefined()
  })
})

describe('the night nurse', () => {
  it('has the old nurse’s proportions on the page: her height, a trunk longer than her legs’ share, her hips (the Owner prefers the old look)', () => {
    // From the old game's review sheets (round0-proportions.txt): 71 and 75 rows tall, a trunk of 25 and 26 rows, legs of 35 and 37, a hip row of 22 and 26.
    const p = proportions(NIGHT_NURSE, 1)
    expect(p.height).toBeGreaterThanOrEqual(71)
    expect(p.height).toBeLessThanOrEqual(76)
    expect(p.trunkRows).toBeGreaterThanOrEqual(24)
    expect(p.legRows).toBeLessThanOrEqual(38)
    expect(p.hip).toBeGreaterThanOrEqual(21)
  })

  it('is the old figure: tall, thin and long-armed, her head cocked, drawn as tall as the old game drew her (2 m on the page for its 2.1)', () => {
    expect(NIGHT_NURSE.id).toBe('nurse')
    expect(NIGHT_NURSE.sliders.height).toBe(200)
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

  // The painter's own reference for a face at density 2 (the record of its base pair): a brow two texels thick, an eye with its
  // white beside a dark iris under a dark lid, a nose, a mouth. Each is counted from the picture, in the swatch it is painted in.
  it('draws Ada’s brows two texels thick: a run of two dark brow texels, one above the other, under each side of the fringe', () => {
    const { all, is } = faceAt2(ADA)
    const brows = all('hairBlack')
    expect(brows.length).toBeGreaterThanOrEqual(12)
    expect(brows.filter(([x, y]) => is(x, y + 1, 'hairBlack')).length).toBeGreaterThanOrEqual(6)
  })

  it('draws Ada’s eyes with their whites beside a dark iris, under a dark lid', () => {
    const { cell, is, headRows } = faceAt2(ADA)
    const [w] = cell.size
    const top = rowWidths(cell).findIndex((width) => width > 0)
    const light = (x: number, y: number): boolean => {
      const i = y * w + x
      return [0, 1, 2].every((k) => (cell.painted[i * 4 + k] ?? 0) >= 200)
    }
    const iris = (x: number, y: number): boolean => is(x, y, 'eyeBrown')
    let whites = 0
    let lidded = 0
    for (let y = top + rowAt(headRows, 8 / 24); y < top + headRows; y++)
      for (let x = 40; x < 90; x++)
        if (light(x, y) && (iris(x - 1, y) || iris(x + 1, y))) {
          whites++
          // The lid: dark texels directly over the iris beside it.
          if (iris(x - 1, y - 1) || iris(x + 1, y - 1) || iris(x, y - 1)) lidded++
        }
    expect(whites).toBeGreaterThanOrEqual(4)
    expect(lidded).toBeGreaterThanOrEqual(2)
  })

  it('has the base woman’s eyes, not the base man’s lid: her crease, hood and liner are base-f’s own (the Owner, 2026-11-12: “Why does she have the boy eyes?”)', () => {
    const woman = (BASE[1] as { def: CharacterDef }).def.sliders.face
    const mine = ADA.sliders.face
    for (const key of ['crease', 'hood', 'liner', 'eyeSize'] as const)
      expect(mine?.[key], key).toBe(woman?.[key])
  })

  it('draws Ada a mouth: lips of at least four texels in the middle of her face, below her eyes', () => {
    const { cell, is, headRows } = faceAt2(ADA)
    const [w] = cell.size
    const top = rowWidths(cell).findIndex((width) => width > 0)
    let lips = 0
    // The eyes are about 17 rows of 24 under the crown; the mouth's rows are below them and the lips are in the middle, clear of the hair at the sides.
    for (let y = top + rowAt(headRows, 19 / 24); y < top + headRows + 3; y++)
      for (let x = Math.round(w / 2) - 5; x <= Math.round(w / 2) + 5; x++) if (is(x, y, 'lipsAda')) lips++
    expect(lips).toBeGreaterThanOrEqual(4)
  })

  it('draws the mouth in two rows and two tones, as the painter’s reference does: a darker upper lip row over a lit lower lip row of the same width', () => {
    const { cell, headRows } = faceAt2(ADA)
    const [w] = cell.size
    const top = rowWidths(cell).findIndex((width) => width > 0)
    const [upper, lower] = ((ADA.swatches?.lipsAda?.paint ?? []) as readonly string[]).map((hex) =>
      [1, 3, 5].map((k) => Number.parseInt(hex.slice(k, k + 2), 16)),
    ) as [number[], number[]]
    const at = (x: number, y: number, c: number[]) =>
      c.every((v, k) => cell.painted[(y * w + x) * 4 + k] === v)
    let rows: [number, number] | undefined
    for (let y = top + rowAt(headRows, 19 / 24); y < top + headRows + 3 && !rows; y++) {
      const xs = [...Array(w).keys()].filter((x) => at(x, y, upper))
      const same = xs.filter((x) => at(x, y + 1, lower))
      if (xs.length >= 2 && same.length >= xs.length) rows = [xs.length, same.length]
    }
    expect(rows, 'an upper lip row with a lit lower lip row under it').toBeDefined()
  })

  // The lower lip was #d28d7a on her #ce9770 skin, .033 apart in OKLab (under two just-noticeable steps), and in play #c58c77 on #b5816a: the
  // mouth read as one dark band. Three such steps apart reads at a glance; it stays a lit lip, well lighter than the upper (two tones).
  it('gives the lower lip a tone of its own: three noticeable steps from her skin, and clearly lighter than the upper lip', () => {
    const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    const oklab = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((k) => lin(Number.parseInt(hex.slice(k, k + 2), 16) / 255)) as [
        number,
        number,
        number,
      ]
      const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
      const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
      const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
      return [
        0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
      ]
    }
    const apart = (x: string, y: string) => Math.hypot(...oklab(x).map((v, k) => v - (oklab(y)[k] as number)))
    const [upper = '', lower = ''] = (ADA.swatches?.lipsAda?.paint ?? []) as readonly string[]
    const skin = (ADA.swatches?.[ADA.skin]?.paint ?? SWATCHES[ADA.skin]?.paint ?? [])[1] ?? ''
    expect(apart(lower, skin)).toBeGreaterThanOrEqual(0.06)
    expect((oklab(lower)[0] as number) - (oklab(upper)[0] as number)).toBeGreaterThanOrEqual(0.15)
  })

  // Her auburn's second tone #662b29 is DUEL row 2's red step (24 degrees of OKLab hue), and the room darkens its base #885041 into row 2's
  // #733d3b (23): in the hall her crown read as three patches, a maroon band, a mauve patch and pink between, not one head of hair. Every
  // tone of her hair with colour in it (chroma .035 or more: the near-black deepest has no hue to keep) is a brown, 30 degrees or more.
  it('paints her hair in browns only: no red step in its ramp', () => {
    const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    const lch = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((k) => lin(Number.parseInt(hex.slice(k, k + 2), 16) / 255)) as [
        number,
        number,
        number,
      ]
      const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
      const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
      const q = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
      const [a, bb] = [
        1.9779984951 * l - 2.428592205 * m + 0.4505937099 * q,
        0.0259040371 * l + 0.7827717662 * m - 0.808675766 * q,
      ]
      return { C: Math.hypot(a, bb), h: (Math.atan2(bb, a) * 180) / Math.PI }
    }
    const street = ADA.outfits.street ?? []
    const hair = street.find((piece) => 'hair' in piece) as { hair: string }
    const paint = (ADA.swatches?.[hair.hair]?.paint ?? []) as readonly string[]
    expect(paint.length).toBe(4)
    const red = paint.filter((c) => lch(c).C >= 0.035 && lch(c).h < 30)
    expect(red).toEqual([])
  })

  it('puts no pale texel under the lower lip: the chin’s catch-light is never the texel right under the mouth (it read as a tongue)', () => {
    const { cell, is, all } = faceAt2(ADA)
    const [w] = cell.size
    const light = coloursOf(ADA, ADA.skin)[0] ?? []
    const under = all('lipsAda').filter(([x, y]) => !is(x, y + 1, 'lipsAda') && is(x, y, 'lipsAda'))
    expect(under.length).toBeGreaterThan(0)
    for (const [x, y] of under) {
      const i = ((y + 1) * w + x) * 4
      expect(
        light.every((v, k) => cell.painted[i + k] === v),
        `texel (${x}, ${y + 1}) under the lips`,
      ).toBe(false)
    }
  })

  it('shows floor between Ada’s legs below the knee from density 2, where the cutscene shots begin: two legs, not one block', () => {
    // Her hips are a slim build's now (0.65, not the 1 that drew the old figure's leg gap at the play size), so at density 1 her legs nearly touch.
    for (const density of [2, 4] as const) {
      const cell = paintedCell(ADA, 0, density)
      const { top, height } = silhouette(cell)
      const rows = rowGaps(cell).slice(top + Math.round(height * 0.7), top + Math.round(height * 0.92))
      expect(
        rows.reduce((a, b) => a + b, 0),
        `density ${density}`,
      ).toBeGreaterThanOrEqual(8 * density)
    }
  })

  it('shows Ada’s waistcoat open: a strip of her cream shirt between its two oxblood sides, not a slit', () => {
    const cell = paintedCell(ADA, 0, 2)
    const [w, h] = cell.size
    const is = (i: number, swatch: string) =>
      (ADA.swatches?.[swatch]?.paint ?? []).some((hex) =>
        [1, 3, 5].every((k, n) => cell.painted[i * 4 + n] === Number.parseInt(hex.slice(k, k + 2), 16)),
      )
    let between = 0
    for (let y = 0; y < h; y++) {
      const xs = [...Array(w).keys()].filter((x) => is(y * w + x, 'oxblood'))
      const [first, last] = [xs[0] ?? 0, xs[xs.length - 1] ?? 0]
      for (let x = first + 1; x < last; x++) if (is(y * w + x, 'cream')) between++
    }
    // A V of shirt to the sternum (the generated images' waistcoat): four times the texels it is at density 1.
    expect(between).toBeGreaterThanOrEqual(48)
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

  it('shows Ada in an oxblood waistcoat over her cream shirt, in brown boots', () => {
    expect(seen(ADA, 'oxblood')).toBeGreaterThan(150)
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
    ])
    for (const piece of HELD) {
      expect(piece.why.length).toBeGreaterThan(10)
      expect(piece.instead.length).toBeGreaterThan(3)
    }
  })
})

describe('how a figure is painted in play', () => {
  it('is the painter’s density 2 at whole pixels: a texel is a whole number of field pixels, whatever the camera’s zoom, and the skin keeps its hue in the ward’s cool light', () => {
    // A face reads at density 2 (the painter's note: faces that read at D2): its brows and lids are one or two texels thick at every density,
    // so a finer paint makes them hair-thin lines, and a coarser one dots. The camera is set so a texel is one field pixel (the level's views).
    // On its texel lattice (`grid`), so the LCD panel's screen mesh, one texel a cell, draws its lines between her texels.
    expect(PLAY_FIGURE).toEqual({ crisp: true, density: 2, holdSkinHue: true, dimmest: 1, grid: true })
  })
})

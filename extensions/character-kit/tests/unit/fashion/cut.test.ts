// The cut of the painted garments, read from the picture: a waistcoat that fits the waist, a hem the character chooses and an
// armhole that lets the shirt show at the shoulder, and trousers that taper to the ankle. Each is a data option of the garment, so
// every character's clothes take it; each test draws the same figure with the option at either end and reads the cloth's own rows
// (`rowWidths` of its swatch), at density 2 from the front.
import { describe, expect, it } from 'vitest'
import { registerFashion } from '#src/features/fashion/register-fashion.ts'
import { FASHION_SWATCHES } from '#src/features/fashion/swatches.ts'
import { BASE, type CharacterDef, type Material } from '#src/shared/figure-builder/door.ts'
import { paintedCell, rowGaps, rowWidths, silhouette } from '#src/testing/painted-cell.ts'

registerFashion()

/** Two cloths of colours the painter's DUEL palette holds, each four steps, so each cloth's texels are its own. */
const own = (paint: string[], ramp = 10, base = 4): Material => ({ ramp, base, paint })
const SWATCHES = {
  vest: own(['#904647', '#6e2434', '#492129', '#2e1026']),
  denim: own(['#366b8a', '#25466b', '#23324d', '#181f2f']),
  // The shirt a vest opens on, its colours its own (a ribbed knit has none the painter's palette names).
  shirt: own(['#fff3d6', '#eadbc9', '#ccc3b1', '#bbafa4'], 1, 4),
} as const

const BASE_DEF = (BASE[0] as { def: CharacterDef }).def

/** The base figure in a cream tee and `garments`, no hair, seen from the front. */
function wearing(garments: CharacterDef['outfits'][string]): CharacterDef {
  return {
    ...BASE_DEF,
    swatches: { ...FASHION_SWATCHES, ...SWATCHES },
    default: 'test',
    outfits: { test: [{ tee: 'shirt', sleeves: 'short' }, ...garments, { eyes: 'eyeBrown' }] },
  }
}

/** The widths, row by row, of one swatch of `def` from the front, and the first and last row it paints. */
function rowsOf(def: CharacterDef, swatch: keyof typeof SWATCHES) {
  const widths = rowWidths(paintedCell(def, 0, 2), { def, swatch })
  const first = widths.findIndex((w) => w > 0)
  const last = widths.length - 1 - [...widths].reverse().findIndex((w) => w > 0)
  return { widths, first, last }
}

/** The rows `from` to `to` of the cloth's own span (0 its first row, 1 its last). */
const band = (r: ReturnType<typeof rowsOf>, from: number, to: number): number[] =>
  r.widths.slice(
    r.first + Math.round((r.last - r.first) * from),
    r.first + Math.round((r.last - r.first) * to) + 1,
  )
const widest = (r: ReturnType<typeof rowsOf>, from: number, to: number): number =>
  Math.max(...band(r, from, to))
const narrowest = (r: ReturnType<typeof rowsOf>, from: number, to: number): number =>
  Math.min(...band(r, from, to))

describe('a waistcoat fits', () => {
  const vest = (o: object) => rowsOf(wearing([{ waistcoat: 'vest', ...o }, { jeans: 'denim' }]), 'vest')

  it('closes in at the waist when it is fitted: its narrowest row there is narrower than a loose one’s', () => {
    // The clearance differs by 0.7 of a texel a side at the waist ring and nowhere else, so it is the narrowest row of the waist's band
    // that moves (the widest, at the hip, does not).
    expect(narrowest(vest({ fit: 1 }), 0.5, 1)).toBeLessThan(narrowest(vest({ fit: 0 }), 0.5, 1))
  })

  it('keeps its shoulder and chest when it closes in at the waist (it is a vest, not a cinch)', () => {
    expect(widest(vest({ fit: 1 }), 0, 0.3)).toBeGreaterThanOrEqual(widest(vest({ fit: 0 }), 0, 0.3) - 2)
  })

  it('ends where the character says: a short vest at the waist, a long one at the hip', () => {
    const short = vest({ length: 0 })
    const long = vest({ length: 1 })
    expect(long.last - short.last).toBeGreaterThan(8)
  })

  it('has an armhole: the shirt shows at the shoulder, so the vest is narrower across it', () => {
    expect(widest(vest({ armhole: 1 }), 0, 0.2)).toBeLessThan(widest(vest({ armhole: 0 }), 0, 0.2))
  })
})

/** The texels of the `shirt` between the first and last texel of the vest in each row: the shirt a vest stands open on, not a sleeve beside it. */
function shirtBetweenVest(def: CharacterDef): number {
  const { painted, size } = paintedCell(def, 0, 2)
  const hex = (name: keyof typeof SWATCHES) => SWATCHES[name].paint ?? []
  const is = (i: number, paint: readonly string[]) =>
    paint.some((c) =>
      [1, 3, 5].every((k, n) => painted[i * 4 + n] === Number.parseInt(c.slice(k, k + 2), 16)),
    )
  let count = 0
  for (let y = 0; y < size[1]; y++) {
    let first = -1
    let last = -1
    for (let x = 0; x < size[0]; x++)
      if (is(y * size[0] + x, hex('vest'))) {
        if (first < 0) first = x
        last = x
      }
    for (let x = first + 1; x < last; x++) if (is(y * size[0] + x, hex('shirt'))) count++
  }
  return count
}

describe('a waistcoat stands open', () => {
  const open = (o: object) => wearing([{ waistcoat: 'vest', fit: 1, length: 0.05, ...o }, { jeans: 'denim' }])

  it('on a panel of the shirt down its front: more shirt between its sides than the V it had', () => {
    expect(shirtBetweenVest(open({ open: 1 }))).toBeGreaterThan(shirtBetweenVest(open({ open: 0 })) + 20)
  })

  it('as little as a V of shirt at 0', () => {
    expect(shirtBetweenVest(open({ open: 0 }))).toBe(shirtBetweenVest(open({})))
  })

  it('as wide at the chest as the character sets it', () => {
    expect(shirtBetweenVest(open({ open: 1, chest: 0.5 }))).toBeGreaterThan(
      shirtBetweenVest(open({ open: 1, chest: 0.2 })) + 8,
    )
  })

  it('as wide at the hem as the character sets it', () => {
    expect(shirtBetweenVest(open({ open: 1, hem: 0.45 }))).toBeGreaterThan(
      shirtBetweenVest(open({ open: 1, hem: 0.1 })) + 8,
    )
  })
})

describe('a waistcoat has a neckline', () => {
  const vest = (o: object) => rowsOf(wearing([{ waistcoat: 'vest', ...o }, { jeans: 'denim' }]), 'vest')

  it('that starts lower when the character sets one, so the shirt’s collar shows above it', () => {
    expect(vest({ neckline: 1 }).first).toBeGreaterThan(vest({ neckline: 0 }).first)
  })
})

describe('trousers taper', () => {
  const legs = (o: object) => rowsOf(wearing([{ trousers: 'denim', ...o }]), 'denim')

  it('to the ankle when they are cut to: the hem is narrower than the knee', () => {
    const straight = legs({ taper: 0 })
    const tapered = legs({ taper: 1 })
    expect(widest(tapered, 0.9, 1)).toBeLessThan(widest(straight, 0.9, 1) - 1)
  })

  it('keep their thigh when they taper (the cut is below the knee)', () => {
    expect(widest(legs({ taper: 1 }), 0, 0.3)).toBe(widest(legs({ taper: 0 }), 0, 0.3))
  })

  it('jeans take the option too', () => {
    const jeans = (o: object) => rowsOf(wearing([{ jeans: 'denim', ...o }]), 'denim')
    expect(widest(jeans({ taper: 1 }), 0.9, 1)).toBeLessThan(widest(jeans({ taper: 0 }), 0.9, 1) - 1)
  })
})

describe('legs set a gap', () => {
  /** The rows of the front view from the knee down (a share of the figure's height, 0.7 to 0.93), as the floor showing between the legs and the width across them. */
  const below = (def: CharacterDef) => {
    const cell = paintedCell(def, 0, 2)
    const { top, height } = silhouette(cell)
    const rows = (list: number[]) =>
      list.slice(top + Math.round(height * 0.7), top + Math.round(height * 0.93))
    return { gaps: rows(rowGaps(cell)), widths: rows(rowWidths(cell)) }
  }
  const sum = (list: number[]) => list.reduce((a, b) => a + b, 0)

  for (const kind of ['jeans', 'trousers'] as const) {
    // A pipe cut (taper 0) is as wide at the shin as the knee, which closes the floor on its own; the leg's own narrowing leaves it to the gap.
    const legs = (o: object) => wearing([{ [kind]: 'denim', taper: 1, ...o } as never])

    it(`lets the floor show between ${kind} below the knee: each leg’s cloth gives up its clearance on the inside`, () => {
      const [shut, apart] = [below(legs({ gap: 0 })), below(legs({ gap: 1 }))]
      expect(sum(apart.gaps)).toBeGreaterThan(sum(shut.gaps) + 10)
    })

    it(`keeps the outer line of ${kind} where it was: the pair is no narrower across than the body’s own legs`, () => {
      const [shut, apart] = [below(legs({ gap: 0 })), below(legs({ gap: 1 }))]
      expect(Math.max(...apart.widths)).toBe(Math.max(...shut.widths))
    })
  }
})

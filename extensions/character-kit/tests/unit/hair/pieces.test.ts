import { measure, skeletonFromGenes } from '@automata/3d/figures'
import { hairParts } from '@automata/3d/figures-kit'
import { describe, expect, it } from 'vitest'
import '#src/features/hair/register-hair.ts'
import { KIT_PIECES } from '#src/features/hair/register-hair.ts'
import { kitFixture } from '#src/testing/kit-fixture.ts'

// Every piece of the kit is built by a style of the fixtures (or, for loose hair, by fall.test.ts), and each style builds.

const m = measure({})
const s = skeletonFromGenes(m.genes)
const input = (capped = false) => ({ m, s, hair: 'hair-dark', skin: 'fair', made: {}, capped })
const FIXTURE_STYLES = [
  'box-braid-pony',
  'choppy-layers',
  'cornrows',
  'high-top-fade',
  'locs',
  'quiff-fade',
  'short-fade',
  'sleek-bun',
]

describe('the kit’s hairstyles', () => {
  it('are eight, beside the three core’s fixture has', async () => {
    const { library } = await kitFixture()
    expect(Object.keys(library.hair).sort()).toEqual([...FIXTURE_STYLES, 'bob', 'cropped', 'curtain'].sort())
  })
  for (const id of FIXTURE_STYLES)
    it(`${id} builds`, async () => {
      const style = (await kitFixture()).library.hair[id]
      if (!style) throw new Error(`no style ${id}`)
      const { parts } = hairParts(input(), style)
      expect(parts.length).toBeGreaterThan(0)
    })
  it('between them use every kind of piece the kit has, except loose hair (fall.test.ts)', async () => {
    const { library } = await kitFixture()
    const used = new Set(
      FIXTURE_STYLES.flatMap((id) => (library.hair[id]?.pieces ?? []).flatMap((piece) => Object.keys(piece))),
    )
    expect([...used].sort()).toEqual(
      KIT_PIECES.map((p) => p.kind)
        .filter((k) => k !== 'fall')
        .sort(),
    )
  })
})

describe('strands (the older list of locks, once written as a fall)', () => {
  it('a lock for a bare head is left out under a cap, and a lock for a cap is left out bare', async () => {
    const style = (await kitFixture()).library.hair['choppy-layers']
    if (!style) throw new Error('no choppy-layers')
    const count = (capped: boolean) => hairParts(input(capped), style).parts.length
    expect(count(true)).not.toBe(count(false))
  })
  it('a lock off the middle of the head is mirrored to the other side', () => {
    const rope = { r: 0.14 }
    const strand = (angle: number) =>
      hairParts(input(), {
        pieces: [{ strands: { at: [[angle, 0.5, -0.5]], lift: 0.05, plumb: 0.1, rope } }],
      } as never).parts.length
    expect(strand(1)).toBe(2 * strand(0))
  })
})

describe('which pieces lie on the crown', () => {
  const tags = (piece: object) => hairParts(input(), { pieces: [piece] } as never).parts.map((p) => p.tag)
  const scalp = {
    from: [
      [0, 0.44],
      [1.2, -0.18],
      [3.1416, -0.55],
    ],
    lift: 0.05,
  }
  it('a shell does, a fade’s tiers (the head’s own surface) do not', () => {
    expect(new Set(tags({ scalp }))).toEqual(new Set(['crown']))
    expect(
      new Set(
        tags({
          scalp: {
            ...scalp,
            tone: 'fade',
            grade: [
              [0.3, 'fade1'],
              [0.6, 'fade2'],
            ],
          },
        }),
      ),
    ).toEqual(new Set([undefined]))
  })
})

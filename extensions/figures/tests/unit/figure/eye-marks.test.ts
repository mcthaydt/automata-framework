import { describe, expect, it } from 'vitest'
import { BASE } from '#src/shared/base/base-pair.ts'
import { Figure } from '#src/shared/figure/figure.ts'
import { member, view } from '#src/shared/figure/frames.ts'
import type { HairStyle, Piece } from '#src/shared/hair/hair.ts'
import { type Garment, SWATCHES } from '#src/shared/outfit/garments.ts'
import { FACE_SEAM, tonesOf } from '#src/shared/paint/paint.ts'
import { dressed } from '../../fixtures/draw'

/**
 * The face marks as options of the `eyes` garment, each drawn on the base woman with and without it:
 * the neutral eye mark of an undrawn face (its size and its set, `mark`), the drawn face's nose and mouth (`nose`, `mouth`)
 * and its eyes kept in the face's visible rows when hair hangs over them (`keep`). Every default draws the face as before.
 */
const woman = BASE[1].def
const eyes = (extra: object = {}): Garment =>
  ({ eyes: 'eyeBrown', lids: 'lidDeep', white: 'eyeWhite', lips: 'lipsWarm', ...extra }) as Garment
const FRINGE: Piece = {
  fringe: {
    from: [
      [0, 0.5],
      [0.7, 0.45],
      [1.1, 0.3],
    ],
    width: 0.75,
    length: 1.3,
    count: 9,
    rope: { r: 0.15 },
  },
} as Piece
const SCALP: Piece = {
  scalp: {
    from: [
      [0, 0.5],
      [0.7, 0.4],
      [1.9, 0.3],
      // biome-ignore lint/suspicious/noApproximativeNumericConstant: a knot as written in the library; Math.PI is 7e-6 away and would move the curve
      [3.1416, 0.14],
    ],
    lift: 0.04,
  },
} as Piece
const HAIR_FRINGE: HairStyle = {
  about: 'a cap and a fringe past the brow',
  finish: 'smooth',
  pieces: [SCALP, FRINGE],
}
const wear = (garments: Garment[], face: Record<string, unknown> = {}) => {
  const d = dressed(garments, undefined, woman)
  return { ...d, face: { ...d.face, ...face } }
}
function draw(def: ReturnType<typeof wear>, D: number, d = 0) {
  const cast = member(def, D),
    f = new Figure(cast)
  for (let i = 0; i < 3; i++) f.update(1 / 60, { facing: (d * Math.PI) / 4, moving: false, view: view() })
  return { f, w: cast.cell[0], h: cast.cell[1] }
}
type Drawn = ReturnType<typeof draw>
const rgbAt = (s: Drawn, k: number) =>
  (s.f.painted[k * 4] << 16) | (s.f.painted[k * 4 + 1] << 8) | s.f.painted[k * 4 + 2]
/** The texels painted in one of these colours: [x, y] of each. */
function texelsOf(s: Drawn, colours: number[]): [number, number][] {
  const out: [number, number][] = []
  for (let k = 0; k < s.w * s.h; k++)
    if (s.f.painted[k * 4 + 3] && colours.includes(rgbAt(s, k))) out.push([k % s.w, Math.floor(k / s.w)])
  return out
}
const EYE = tonesOf(SWATCHES.eyeBrown).slice(0, 2)

describe('the neutral eye mark of an undrawn face (`mark`)', () => {
  const undrawn = (mark?: object) => wear([eyes(mark ? { mark } : {})], { drawn: false })
  it('a mark 1 wide and 2 tall has twice the texels of the default 1 by 1, at density 1', () => {
    const one = texelsOf(draw(undrawn(), 1), EYE).length,
      two = texelsOf(draw(undrawn({ size: [1, 2] }), 1), EYE).length
    expect(one).toBeGreaterThan(0)
    expect(two).toBeGreaterThanOrEqual(one + 2)
  })
  it('x sets the eyes apart: .8 of the half-width is wider than the default .42 (a density 1 head is 3 texels across a side, so a step of .18 moves nothing)', () => {
    const gap = (mark?: object) => {
      const t = texelsOf(draw(undrawn(mark), 1), EYE).map(([x]) => x)
      return Math.max(...t) - Math.min(...t)
    }
    expect(gap({ x: 0.8 })).toBeGreaterThan(gap())
  })
  it('naming the defaults draws the same cells', () => {
    const a = draw(undrawn(), 1).f.painted,
      b = draw(undrawn({ size: [1, 1], x: 0.42 }), 1).f.painted
    expect(Buffer.compare(Buffer.from(a), Buffer.from(b))).toBe(0)
  })
})

describe('the drawn face’s nose and mouth (`nose`, `mouth`)', () => {
  const frame = (extra: object, D: number, d = 0) => draw(wear([eyes(extra)]), D, d).f.painted
  const differs = (a: Uint8ClampedArray, b: Uint8ClampedArray) =>
    Buffer.compare(Buffer.from(a), Buffer.from(b)) !== 0
  // In profile at these sizes the lips sit on the face's edge and the painter draws none, so only the nose has a mark there.
  for (const D of [1, 2])
    for (const d of [0, 1]) {
      it(`nose: false and mouth: false each change the face, and both together change it more (density ${D}, view ${d})`, () => {
        const plain = frame({}, D, d),
          noNose = frame({ nose: false }, D, d),
          noMouth = frame({ mouth: false }, D, d),
          neither = frame({ nose: false, mouth: false }, D, d)
        expect(differs(plain, noMouth), 'no mouth').toBe(true)
        expect(differs(plain, noNose), 'no nose').toBe(true)
        expect(differs(noNose, noMouth)).toBe(true)
        expect(differs(neither, noNose)).toBe(true)
        expect(differs(neither, noMouth)).toBe(true)
      })
    }
  it('nose: false changes the profile too', () => {
    expect(differs(frame({}, 1, 2), frame({ nose: false }, 1, 2))).toBe(true)
  })
})

describe('eyes kept in the face’s visible rows under hair (`keep`)', () => {
  const hung = (keep: boolean) =>
    wear([{ hair: 'hairBlack', style: HAIR_FRINGE } as Garment, eyes(keep ? { keep: true } : {})])
  for (const D of [1, 2])
    it(`a fringe past the brow hides the eyes; with keep they are drawn on the skin that shows (density ${D})`, () => {
      const hidden = texelsOf(draw(hung(false), D), EYE).length,
        kept = texelsOf(draw(hung(true), D), EYE).length
      expect(kept, 'the eyes drawn').toBeGreaterThan(hidden)
    })
  it('keep changes nothing when the eyes are already visible', () => {
    const bare = (keep: boolean) => wear([eyes(keep ? { keep: true } : {})]),
      a = draw(bare(false), 2).f.painted,
      b = draw(bare(true), 2).f.painted
    expect(Buffer.compare(Buffer.from(a), Buffer.from(b))).toBe(0)
  })
})
void FACE_SEAM

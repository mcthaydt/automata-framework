import { describe, expect, it } from 'vitest'
import { BASE } from '#src/shared/base/base-pair.ts'
import { Figure } from '#src/shared/figure/figure.ts'
import { member, view } from '#src/shared/figure/frames.ts'
import { type HandForm, handForm, handPiece } from '#src/shared/paint/paint-hand-form.ts'
import { drawHands } from '#src/shared/paint/paint-hands.ts'

/**
 * The parted hand (paint-hand-form.ts, drawn by paint-hands.ts with `form` 'parted') reads as a thumb, an index finger and the other three fingers as one mitten, on
 * every body: the thumb is a bump off the palm's side, creased from it, its tip clear; the index is parted from
 * the mitten by a crease of the skin (never ink inside the hand) and steps a row past it, and a hand too small for
 * either stays one clean shape (no stray texel at density 1).
 */
/** The form's pieces as a grid, rows down from the wrist, columns from the little finger's edge to past the thumb. */
const grid = (f: HandForm) =>
  Array.from({ length: f.last + 1 }, (_, row) =>
    Array.from({ length: f.Wk + 2 }, (_, col) => handPiece(f, row, col)),
  )

describe('the hand form at the showcase density', () => {
  // The base man's stylised hand at density 2: as the front view now shows it (its back half turned to us) and from the
  // side (broad).
  for (const [name, Ww, Wk] of [
    ['front', 5, 6],
    ['side', 6, 8],
  ] as const) {
    const f = handForm({ L: 9.1, Ww, Wk, thumbAt: 0.15, thumbs: true, D: 2 }),
      g = grid(f),
      W = Wk + 2
    const rowsOf = (p: string) => g.map((r, row) => (r.includes(p as never) ? row : -1)).filter((r) => r >= 0)
    it(`${name}: the thumb is a bump two texels across, creased from the palm, its tip clear`, () => {
      const rows = rowsOf('thumb')
      expect(rows.length).toBeGreaterThanOrEqual(3)
      expect(Math.max(...g.map((r) => r.filter((p) => p === 'thumb').length))).toBe(2)
      // A crease of the skin (not a gap) between the thumb and the palm, and background beside its tip.
      expect(g.some((r) => r[Wk - 1] === 'crease' && r[Wk] === 'thumb')).toBe(true)
      const tip = rows[rows.length - 1]
      expect(g[tip][Wk]).toBe(null)
      expect(g[tip][Wk + 1]).toBe('thumb')
    })
    it(`${name}: the index is creased from the mitten and steps out a row past its rounded end`, () => {
      expect(
        g.filter((r) => r.includes('crease') && r.includes('index') && r.includes('mitten')).length,
      ).toBeGreaterThanOrEqual(1)
      expect(Math.max(...rowsOf('index'))).toBe(Math.max(...rowsOf('mitten')) + 1)
      // No gap inside the hand: every row is one run from its first texel to its last, but beside the thumb's tip.
      g.forEach((r, row) => {
        const on = r.map((p, c) => (p ? c : -1)).filter((c) => c >= 0)
        if (on.length && !r.includes('thumb'))
          expect(on[on.length - 1] - on[0] + 1, `row ${row}`).toBe(on.length)
      })
    })
    it(`${name}: the mitten is one block of at least three columns, its little finger's corner rounded`, () => {
      for (const r of g) {
        const cols = r.map((p, c) => (p === 'mitten' ? c : -1)).filter((c) => c >= 0)
        if (cols.length) expect(cols[cols.length - 1] - cols[0] + 1).toBe(cols.length)
      }
      expect(Math.max(...g.map((r) => r.filter((p) => p === 'mitten').length))).toBeGreaterThanOrEqual(3)
      const end = Math.max(...rowsOf('mitten'))
      expect(g[end][0]).toBe(null)
      expect(W).toBeGreaterThan(Wk)
    })
  }
})

describe('a hand too small to part stays one shape', () => {
  for (const [Ww, Wk, L] of [
    [2, 2, 4.3],
    [2, 3, 5],
    [3, 4, 5.2],
  ] as const)
    it(`${Wk} across, ${L} long at density 1: one piece, no texel alone`, () => {
      const f = handForm({ L, Ww, Wk, thumbAt: 0.15, thumbs: true, D: 1 }),
        g = grid(f),
        on = (row: number, col: number) => !!g[row]?.[col]
      // Every texel has a neighbour along a row or a column, and a flood from the wrist reaches every texel.
      const all: [number, number][] = []
      g.forEach((r, row) => {
        r.forEach((p, col) => {
          if (p) all.push([row, col])
        })
      })
      for (const [row, col] of all)
        expect(on(row - 1, col) || on(row + 1, col) || on(row, col - 1) || on(row, col + 1)).toBe(true)
      const seen = new Set<string>(),
        stack = [all[0]]
      for (let next = stack.pop(); next; next = stack.pop()) {
        const [row, col] = next
        if (!on(row, col) || seen.has(`${row},${col}`)) continue
        seen.add(`${row},${col}`)
        stack.push([row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1])
      }
      expect(seen.size).toBe(all.length)
    })
})

/** The hands the base figure paints standing in view d at density D, drawn alone into an empty buffer: per hand, the
 * stamp and its texels (the tone map's). */
function handsOf(def: (typeof BASE)[number]['def'], d: number, D: number) {
  const f = new Figure(member(def, D))
  for (let i = 0; i < 3; i++) f.update(1 / 60, { facing: (d * Math.PI) / 4, moving: false, view: view() })
  const [w, h] = f.member.cell
  return f.handStamps.map((hs) => {
    const n = w * h,
      b = {
        material: new Int16Array(n).fill(-1),
        part: new Int16Array(n).fill(-1),
        group: new Int16Array(n).fill(-1),
        depth: new Float32Array(n).fill(-Infinity),
        normal: new Float32Array(n * 3),
        place: new Float32Array(n * 3),
      }
    // The raster's hand, as one texel at the wrist: the stamp takes its part from it.
    const k = Math.round(hs.wrist[1]) * w + Math.round(hs.wrist[0])
    b.material[k] = hs.material
    b.group[k] = hs.group
    b.part[k] = 0
    b.depth[k] = hs.wrist[2]
    const tone = drawHands([hs], w, h, D, b, 'parted')
    return {
      hs,
      w,
      h,
      tone: Array.from(tone),
      on: (x: number, y: number) => x >= 0 && x < w && tone[y * w + x] >= 0,
    }
  })
}
describe('the base pair standing at density 2: the hand reads in every view', () => {
  for (const c of BASE)
    for (let d = 0; d < 8; d++)
      it(`${c.def.id} view ${d}: a hand four texels broad or more, its fingers creased`, () => {
        for (const { hs, w, h, on, tone } of handsOf(c.def, d, 2)) {
          if (!hs.hangs) continue
          // The widest row of the hand: a readable block, whichever way it is turned.
          let widest = 0
          for (let y = 0; y < h; y++) {
            let n = 0
            for (let x = 0; x < w; x++) if (on(x, y)) n++
            widest = Math.max(widest, n)
          }
          expect(widest, `view ${d}`).toBeGreaterThanOrEqual(4)
          // The index's crease, drawn in the skin's deep step: no ink inside the hand.
          expect(tone.filter((t) => t === 3).length, `view ${d} creases`).toBeGreaterThanOrEqual(1)
        }
      })
})

describe('over skin of its own colour, the creases still show', () => {
  it('a hand hanging over a bare thigh draws its creases a deep step, not the thigh', () => {
    // The base man's near hand in the side view, drawn over a thigh of his own skin that fills the cell behind it.
    const f = new Figure(member(BASE[0].def, 2))
    for (let i = 0; i < 3; i++) f.update(1 / 60, { facing: Math.PI / 2, moving: false, view: view() })
    const [w, h] = f.member.cell,
      hs = f.handStamps.find((s) => Math.round(2 * s.half[1]) >= 6 && s.thumbFacing > -0.55)
    if (!hs) throw new Error('no broad hand with its thumb shown in the side view')
    const n = w * h,
      b = {
        material: new Int16Array(n).fill(hs.material),
        part: new Int16Array(n).fill(1),
        group: new Int16Array(n).fill(hs.group + 100),
        depth: new Float32Array(n).fill(hs.wrist[2] - 1),
        normal: new Float32Array(n * 3),
        place: new Float32Array(n * 3),
      }
    const k = Math.round(hs.wrist[1]) * w + Math.round(hs.wrist[0])
    b.group[k] = hs.group
    b.depth[k] = hs.wrist[2]
    const tone = drawHands([hs], w, h, 2, b, 'parted')
    // The creases: a deep tone (3) the hand's own tones (0 to 2) never use, and at least the finger gap's two rows.
    expect(Array.from(tone).filter((t) => t === 3).length).toBeGreaterThanOrEqual(2)
  })
})

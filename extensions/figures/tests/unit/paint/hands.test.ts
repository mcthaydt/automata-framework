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
  // The base man's open hand at density 2, as the front view shows it (its back half turned to us) and from the side.
  for (const [name, Ww, Wk] of [
    ['front', 5, 6],
    ['side', 6, 7],
  ] as const) {
    const f = handForm({ L: 9.1, Ww, Wk, thumbAt: 0.15, thumbs: true, D: 2 }),
      g = grid(f)
    const rowsOf = (p: string) => g.map((r, row) => (r.includes(p as never) ? row : -1)).filter((r) => r >= 0)
    const runs = (col: number, p: string) => {
      const out: number[] = []
      let n = 0
      for (const r of g) {
        if (r[col] === p) n++
        else if (n) out.push(n), (n = 0)
      }
      if (n) out.push(n)
      return out
    }
    it(`${name}: an open hand, half again as long as it is broad`, () => {
      expect(f.last + 1).toBeGreaterThanOrEqual(Math.ceil(1.4 * Wk))
    })
    it(`${name}: the thumb lies along the palm's side, one texel out, its tip clear`, () => {
      const rows = rowsOf('thumb')
      expect(rows.length).toBeGreaterThanOrEqual(3)
      expect(Math.max(...g.map((r) => r.filter((p) => p === 'thumb').length))).toBe(1)
      expect(g.some((r) => r[Wk + 1])).toBe(false)
      expect(g[rows[rows.length - 1] + 1][Wk]).toBe(null)
    })
    it(`${name}: the index, two columns, creased from the mitten by one run, ending a row past it`, () => {
      const cols = g[f.last].map((p, c) => (p === 'index' ? c : -1)).filter((c) => c >= 0)
      expect(cols.length).toBe(2)
      expect(Math.max(...rowsOf('index'))).toBe(Math.max(...rowsOf('mitten')) + 1)
      const crease = cols[0] - 1
      expect(runs(crease, 'crease')).toEqual([expect.any(Number)])
      expect(runs(crease, 'crease')[0]).toBeGreaterThanOrEqual(3)
    })
    it(`${name}: every crease is a run of three or more`, () => {
      for (let c = 0; c < Wk; c++) for (const n of runs(c, 'crease')) expect(n).toBeGreaterThanOrEqual(3)
    })
    it(`${name}: the mitten is one block, its end tapered on both corners`, () => {
      for (const r of g) {
        const cols = r.map((p, c) => (p === 'mitten' ? c : -1)).filter((c) => c >= 0)
        if (cols.length) expect(cols[cols.length - 1] - cols[0] + 1).toBe(cols.length)
      }
      const end = Math.max(...rowsOf('mitten')),
        above = g[end - 1].filter((p) => p === 'mitten').length
      expect(g[end].filter((p) => p === 'mitten').length).toBeLessThan(above)
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
      it(`${c.def.id} view ${d}: a hand four texels broad or more, parted by creases, not gaps`, () => {
        for (const { hs, w, h, on } of handsOf(c.def, d, 2)) {
          if (!hs.hangs) continue
          // The widest row of the hand: a readable block, whichever way it is turned.
          let widest = 0
          for (let y = 0; y < h; y++) {
            let n = 0
            for (let x = 0; x < w; x++) if (on(x, y)) n++
            widest = Math.max(widest, n)
          }
          expect(widest, `view ${d}`).toBeGreaterThanOrEqual(4)
          // No ink inside the hand: its partings are creases, so a row of it is one run but beside the thumb's tip.
          let parted = 0
          for (let y = 0; y < h; y++) {
            let runs = 0
            for (let x = 0; x < w; x++) if (on(x, y) && !on(x - 1, y)) runs++
            if (runs > 1) parted++
          }
          expect(parted, `view ${d} rows parted by background`).toBeLessThanOrEqual(2)
        }
      })
})

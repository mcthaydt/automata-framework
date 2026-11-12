import { describe, expect, it } from 'vitest'
import { BASE } from '#src/shared/base/base-pair.ts'
import { Figure } from '#src/shared/figure/figure.ts'
import { member, view } from '#src/shared/figure/frames.ts'
import { OUTLINE } from '#src/shared/paint/paint-budget.ts'
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

describe('the hand form at the showcase density: three shapes, sharply divided', () => {
  // The Owner: "there should be a sharp divide between the combined 3 fingers, index, and thumb". The base man's hand
  // at density 2 as the front view shows it (its back half turned to us), the woman's, and a broad side view.
  for (const [name, Ww, Wk] of [
    ['man', 6, 7],
    ['woman', 5, 6],
    ['broad', 7, 8],
  ] as const) {
    const f = handForm({ L: 1.5 * Wk, Ww, Wk, thumbAt: 0.15, thumbs: true, D: 2 }),
      g = grid(f)
    const rowsOf = (p: string) => g.map((r, row) => (r.includes(p as never) ? row : -1)).filter((r) => r >= 0)
    const colsOf = (row: number, p: string) => g[row].map((q, c) => (q === p ? c : -1)).filter((c) => c >= 0)
    const runs = (col: number, p: string) => {
      const out: number[] = []
      let n = 0
      for (const r of g) {
        if (r[col] === p) n++
        else if (n) {
          out.push(n)
          n = 0
        }
      }
      if (n) out.push(n)
      return out
    }
    it(`${name}: an open hand, half again as long as it is broad`, () => {
      expect(f.last + 1).toBeGreaterThanOrEqual(Math.ceil(1.4 * Wk))
    })
    it(`${name}: the index, two columns, divided from a mitten of three or more by one ink run to a notch`, () => {
      const index = colsOf(f.last, 'index')
      expect(index.length).toBe(2)
      const end = Math.max(...rowsOf('mitten'))
      expect(end).toBeLessThan(f.last)
      for (let row = f.sk + 1; row <= end; row++)
        expect(colsOf(row, 'mitten').length, `row ${row}`).toBeGreaterThanOrEqual(3)
      // The divide: one run from the knuckle row down, then the notch, background between the tips.
      const col = index[0] - 1
      expect(runs(col, 'divide')).toEqual([expect.any(Number)])
      expect(runs(col, 'divide')[0]).toBeGreaterThanOrEqual(3)
      expect(g[f.sk + 1][col]).toBe('divide')
      expect(g[end][col]).toBe(null)
      expect(g[end][col - 1]).toBe('mitten')
      expect(g[end][col + 1]).toBe('index')
    })
    it(`${name}: the thumb, two texels thick and three or more long, lies down the palm's side, its tip free`, () => {
      const rows = rowsOf('thumb')
      expect(rows.length).toBeGreaterThanOrEqual(3)
      expect(Math.max(...rows)).toBeLessThan(f.sk)
      expect(Math.max(...rows.map((r) => colsOf(r, 'thumb').length))).toBe(2)
      // Never horizontal, never more than two columns past the palm, and angled away: its tip no nearer the palm.
      expect(rows.length).toBeGreaterThan(2)
      expect(g.some((r) => r[Wk + 2])).toBe(false)
      const tip = Math.max(...rows)
      expect(Math.min(...colsOf(tip, 'thumb'))).toBeGreaterThanOrEqual(Math.min(...colsOf(rows[0], 'thumb')))
      // Divided from the palm in ink along its free length, its tip standing free (background under it and beside it).
      const free = rows.filter((r) => colsOf(r, 'divide').length)
      expect(free.length).toBeGreaterThanOrEqual(2)
      for (const r of free)
        expect(Math.max(...colsOf(r, 'divide'))).toBeLessThan(Math.min(...colsOf(r, 'thumb')))
      for (const c of colsOf(tip, 'thumb')) expect(g[tip + 1][c]).toBe(null)
      expect(g[tip][Math.min(...colsOf(tip, 'thumb')) - 1]).toBe(null)
    })
    it(`${name}: no ink texel alone: every divide runs to the silhouette`, () => {
      const seen = new Set<string>()
      g.forEach((r, row) => {
        r.forEach((p, col) => {
          if (p !== 'divide' || seen.has(`${row},${col}`)) return
          let open = false
          const stack: [number, number][] = [[row, col]]
          for (let next = stack.pop(); next; next = stack.pop()) {
            const [y, x] = next
            if (seen.has(`${y},${x}`)) continue
            seen.add(`${y},${x}`)
            for (const [yy, xx] of [
              [y - 1, x],
              [y + 1, x],
              [y, x - 1],
              [y, x + 1],
            ] as const) {
              const q = g[yy]?.[xx] ?? null
              if (q === null) open = true
              else if (q === 'divide') stack.push([yy, xx])
            }
          }
          expect(open, `the divide at ${row},${col}`).toBe(true)
        })
      })
    })
  }
  it('a hand too narrow for three shapes shows two: the fingers and the thumb, sharply divided', () => {
    const f = handForm({ L: 8, Ww: 4, Wk: 5, thumbAt: 0.15, thumbs: true, D: 2 }),
      g = grid(f),
      flat = g.flat()
    expect(flat.includes('index')).toBe(false)
    expect(flat.includes('thumb')).toBe(true)
    expect(flat.includes('divide')).toBe(true)
  })
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
      it(`${c.def.id} view ${d}: a broad hand, divided in ink`, () => {
        for (const { hs, w, h, on, tone } of handsOf(c.def, d, 2)) {
          if (!hs.hangs) continue
          // The widest row of the hand: three shapes and their divides, whichever way it is turned; the man's eight
          // texels or more across with his thumb where the view shows its back.
          let widest = 0
          for (let y = 0; y < h; y++) {
            let n = 0
            for (let x = 0; x < w; x++) if (on(x, y)) n++
            widest = Math.max(widest, n)
          }
          expect(widest, `view ${d}`).toBeGreaterThanOrEqual(
            c.def.id === 'base-m' && [0, 1, 7].includes(d) ? 8 : 6,
          )
          // The divides are the outline's ink, a run of three or more.
          expect(tone.filter((t) => t === OUTLINE).length, `view ${d} ink`).toBeGreaterThanOrEqual(3)
        }
      })
})

describe('a hand over skin of its own colour has a closed contour', () => {
  // The side views, where the hand hangs over the bare thigh: every texel of the thigh beside the hand is the ink line,
  // so the hand reads as lying against the leg, with nothing poking out as a lone shape.
  for (const c of BASE)
    for (const d of [2, 6])
      it(`${c.def.id} view ${d}`, () => {
        const f = new Figure(member(c.def, 2))
        f.cache = false
        f.paintStyle.hand = 'parted'
        for (let i = 0; i < 3; i++)
          f.update(1 / 60, { facing: (d * Math.PI) / 4, moving: false, view: view() })
        const [w, h] = f.cell,
          b = {
            material: f.g.material.slice(),
            part: f.g.part.slice(),
            group: f.g.group.slice(),
            depth: f.g.depth.slice(),
            normal: f.g.normal.slice(),
            place: f.g.place.slice(),
          }
        const tone = drawHands(f.handStamps, w, h, 2, b, 'parted')
        let lies = 0
        for (const hs of f.handStamps)
          for (let k = 0; k < w * h; k++) {
            if (tone[k] < 0 || tone[k] === OUTLINE || b.group[k] !== hs.group) continue
            const x = k % w
            for (const q of [x > 0 ? k - 1 : -1, x < w - 1 ? k + 1 : -1, k - w, k + w]) {
              if (q < 0 || q >= w * h || b.material[q] !== hs.material || b.group[q] === hs.group) continue
              lies++
              expect(tone[q], `the texel beside the hand at ${q % w},${Math.floor(q / w)}`).toBe(OUTLINE)
            }
          }
        expect(lies, 'the hand lies over the thigh').toBeGreaterThan(0)
      })
})

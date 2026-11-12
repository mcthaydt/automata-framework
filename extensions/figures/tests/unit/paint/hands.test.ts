import { describe, expect, it } from 'vitest'
import { BASE } from '#src/shared/base/base-pair.ts'
import { Figure } from '#src/shared/figure/figure.ts'
import { member, view } from '#src/shared/figure/frames.ts'
import { type HandForm, handForm, handPiece } from '#src/shared/paint/paint-hand-form.ts'
import { drawHands } from '#src/shared/paint/paint-hands.ts'

/**
 * The parted hand (paint-hand-form.ts, drawn by paint-hands.ts with `form` 'parted') reads as a thumb, an index finger and the other three fingers as one mitten, on
 * every body: the thumb stands apart from the palm along its length (joined only at its root), the index is parted from
 * the mitten by a gap, and a hand too small for either stays one clean shape (no stray texel at density 1).
 */
/** The form's pieces as a grid, rows down from the wrist, columns from the little finger's edge to past the thumb. */
const grid = (f: HandForm) =>
  Array.from({ length: f.last + 1 }, (_, row) =>
    Array.from({ length: f.Wk + 1 }, (_, col) => handPiece(f, row, col)),
  )

describe('the hand form at the showcase density', () => {
  // The base man's hand at density 2: from the front (narrow, the thumb toward the camera) and from the side (broad).
  for (const [name, Ww, Wk] of [
    ['front', 3, 4],
    ['side', 5, 7],
  ] as const) {
    const f = handForm({ L: 9.1, Ww, Wk, thumbAt: 0.15, thumbs: true, D: 2 }),
      g = grid(f)
    it(`${name}: the thumb stands apart from the palm, joined at its root`, () => {
      const rows = g.map((_, row) => row).filter((row) => g[row][Wk] === 'thumb')
      expect(rows.length).toBeGreaterThanOrEqual(3)
      expect(g[rows[0]][Wk - 1]).toBe('palm')
      expect(rows.filter((row) => g[row][Wk - 1] === null).length).toBeGreaterThanOrEqual(2)
    })
    it(`${name}: the index is parted from the mitten, and shorter`, () => {
      const parted = g.filter((r) => {
        const i = r.lastIndexOf('index'),
          m = r.lastIndexOf('mitten')
        return i > 0 && m >= 0 && r.slice(m + 1, i).includes(null)
      })
      expect(parted.length).toBeGreaterThanOrEqual(2)
      const lastOf = (p: string) => Math.max(...g.map((r, row) => (r.includes(p as never) ? row : -1)))
      expect(lastOf('index')).toBeLessThan(lastOf('mitten'))
    })
    it(`${name}: the mitten is one mass of at least two columns`, () => {
      for (const r of g) {
        const cols = r.map((p, c) => (p === 'mitten' ? c : -1)).filter((c) => c >= 0)
        if (cols.length) expect(cols[cols.length - 1] - cols[0] + 1).toBe(cols.length)
      }
      expect(Math.max(...g.map((r) => r.filter((p) => p === 'mitten').length))).toBeGreaterThanOrEqual(2)
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
    return { hs, w, h, on: (x: number, y: number) => x >= 0 && x < w && tone[y * w + x] >= 0 }
  })
}
/** A row's runs of hand texels. */
function runs(on: (x: number, y: number) => boolean, y: number, w: number) {
  let n = 0
  for (let x = 0; x < w; x++) if (on(x, y) && !on(x - 1, y)) n++
  return n
}

describe('the base pair standing at density 2: the hand reads in every view', () => {
  for (const c of BASE)
    for (let d = 0; d < 8; d++)
      it(`${c.def.id} view ${d}: a thumb parted from the palm, and the index from the mitten where it is broad enough`, () => {
        for (const { hs, w, h, on } of handsOf(c.def, d, 2)) {
          if (!hs.hangs) continue
          // A hanging hand stands upright (its columns kept plumb): the rows between its wrist and its tip.
          const top = Math.round(Math.min(hs.wrist[1], hs.tip[1])),
            bottom = Math.min(h - 1, Math.round(Math.max(hs.wrist[1], hs.tip[1])) + 1),
            split: number[] = []
          for (let y = top; y <= bottom; y++) split.push(runs(on, y, w) >= 2 ? y : -1)
          // The parted spans: runs of rows with a gap across them. The thumb's slit and the fingers' gap lie either
          // side of the knuckle row (whole across), so each is a span of its own; the thumb's shows unless it is turned
          // away, the fingers' where the hand is four texels broad at its knuckles.
          let spans = 0
          split.forEach((y, i) => {
            if (y >= 0 && (i === 0 || split[i - 1] < 0)) spans++
          })
          const thumbShows = hs.thumbFacing > -0.55,
            broad = Math.round(2 * hs.half[1]) >= 4
          expect(spans, `view ${d}`).toBeGreaterThanOrEqual((thumbShows ? 1 : 0) + (broad ? 1 : 0))
        }
      })
})

describe('over skin of its own colour, the gaps are creases', () => {
  it('a hand hanging over a bare thigh draws its slit and its finger gap a deep step, not the thigh', () => {
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

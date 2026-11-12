import { describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { BASE } from '../../../base/base'
import { member, standing } from '../../../src/features/figure/frames'
import { grid } from '../../../src/features/hair/hair'
import type { V3 } from '../../../src/lib/math'
import { nudged, step } from '../../support/ulp'
import type { HeadForm } from '../../../src/features/body/head'

/** How the head's form is read in this file: left as it is (0), or each of its numbers a last bit up (1) or down (-1). */
const form = vi.hoisted(() => ({ dir: 0 as -1 | 0 | 1, calls: 0, size: 0 }))
vi.mock('../../../src/features/body/head', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../src/features/body/head')>()
  /** `x` moved by `form.dir` units in the last place, or by `form.size` of itself when a control run asks for a visible step. */
  const move = (x: number) => {
    // Zero and non-finite values pass through, as in support/ulp.ts: a step from zero is not a last bit but a wrap to NaN.
    if (form.dir === 0 || x === 0 || !Number.isFinite(x)) return x
    form.calls++
    return form.size ? x * (1 + form.dir * form.size) : step(x, form.dir)
  }
  return {
    ...real,
    headForm: (...args: Parameters<typeof real.headForm>): HeadForm => {
      const f = real.headForm(...args)
      return {
        ...f,
        width: (t, side) => move(f.width(t, side)),
        front: (t) => move(f.front(t)),
        back: (t) => move(f.back(t)),
      }
    },
    // The ear reads the form inside head.ts, out of reach of the wrapper above, so what it derives is moved the same way.
    ear: (...args: Parameters<typeof real.ear>) => {
      const e = real.ear(...args)
      return {
        ...e,
        c: e.c.map(move) as V3,
        r: e.r.map(move) as [number, number],
        lobe: e.lobe.map(move) as V3,
      }
    },
  }
})

/**
 * The hair's poles. A grid row pinched to a point (the crown of a scalp) has an outward offset `p − inner(i)` of exactly
 * 0, or of rounding (1e-10 m), so which way its normal faced was the maths library's last bit, not the shape's. On
 * arm64 that turned `nia` on the thin body into a different picture. The rule: a pole faces the way its row does.
 */
const md5 = (px: Uint8ClampedArray) => createHash('md5').update(px).digest('hex')
const COLS = 8,
  TAU = Math.PI * 2
const ring = (r: number, y: number, j: number): V3 => [
  r * Math.cos((TAU * j) / COLS),
  y,
  r * Math.sin((TAU * j) / COLS),
]

/** Three rows of a cone: row 0 a pole at (offset from) the origin, rows 1 and 2 rings above it. */
function cone(offset: V3) {
  const at = (i: number, j: number): V3 => (i === 0 ? offset : ring(0.1 * i, 0.1 * i, j))
  return grid(2, COLS, at, true, (i) => [0, 0.1 * i, 0])
}
/** Row 0's normals against row 1's outward direction (its ring point less its own inner point), column by column. */
function dotsWithRow(offset: V3) {
  const mesh = cone(offset)
  return Array.from({ length: COLS }, (_, j) => {
    const n = mesh.normals.slice(3 * j, 3 * j + 3),
      out = ring(0.1, 0.1, j)
    return n[0] * out[0] + n[1] * (out[1] - 0.1) + n[2] * out[2]
  })
}

describe('a hair-grid pole', () => {
  it('a pole a rounding off its inner point faces the way its row does', () => {
    for (const o of [
      [1e-10, 0, 0],
      [-1e-10, 0, 0],
      [0, 1e-10, 0],
      [0, -1e-10, 0],
      [0, 0, 1e-10],
      [0, 0, -1e-10],
    ] as V3[])
      for (const d of dotsWithRow(o)) expect(d, `offset ${o}`).toBeGreaterThan(0)
  })
  it('a pole exactly on its inner point faces the way its row does', () => {
    for (const d of dotsWithRow([0, 0, 0])) expect(d).toBeGreaterThan(0)
  })
})

describe('the painter under the last bit of the maths', () => {
  it('the base pair paint the same cell whatever the last bit of the maths', () => {
    for (const c of BASE)
      for (let d = 0; d < 8; d++) {
        const paint = () => standing(member(c.def, 2), d)
        const plain = md5(paint())
        for (let seed = 1; seed <= 8; seed++)
          expect(md5(nudged(seed, paint)), `${c.def.id} direction ${d} seed ${seed}`).toBe(plain)
      }
  }, 300_000)
})

describe("the head's form under its own last bit", () => {
  /** The base pair's eight standing views at each density the painter's goldens and sprites use. */
  const cells = () =>
    BASE.flatMap((c) =>
      [1, 2].flatMap((density) =>
        Array.from({ length: 8 }, (_, d) => ({
          key: `${c.def.id} density ${density} view ${d}`,
          md5: md5(standing(member(c.def, density), d)),
        })),
      ),
    )
  it("no painted cell depends on the last bit of the head's width, front and back at any t", () => {
    const plain = cells()
    for (const dir of [1, -1] as const) {
      form.dir = dir
      form.calls = 0
      try {
        const moved = cells()
        expect(form.calls, 'the form was read').toBeGreaterThan(0)
        moved.forEach((cell, i) =>
          expect(cell.md5, `${cell.key}, a last bit ${dir > 0 ? 'up' : 'down'}`).toBe(plain[i].md5),
        )
      } finally {
        form.dir = 0
      }
    }
  }, 300_000)
  it('control: a visible step in the same form does move a cell, so the case above would have seen a bit that mattered', () => {
    const plain = cells()
    form.dir = 1
    form.size = 0.05
    try {
      expect(cells().some((cell, i) => cell.md5 !== plain[i].md5)).toBe(true)
    } finally {
      form.dir = 0
      form.size = 0
    }
  }, 300_000)
})

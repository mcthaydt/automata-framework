import { describe, expect, it } from 'vitest'
import { BASE } from '../../../base/base'
import { measure, type Sliders } from '../../../src/features/body/genes'
import { insideHead, headForm } from '../../../src/features/body/head'
import { GROUP, reach, type Part } from '../../../src/features/body/parts'
import { J, skeleton } from '../../../src/features/body/rig'
import { Figure } from '../../../src/features/figure/figure'
import { member, view } from '../../../src/features/figure/frames'
import { HAIR_STYLES, registerHairPiece, type HairStyle, type Piece } from '../../../src/features/hair/hair'
import { SWATCHES, dress, type Garment } from '../../../src/features/outfit/garments'
import { BODY, endsOf } from '../body/ends'
import { dressed, differs } from '../draw'

/**
 * The fringe piece (hair.ts `Fringe`) and the styles built on it (library/hair.json: `bob`, `bobFringe`, `longFront`): clumps
 * from the crown over the forehead to a length (0 the hairline, 1 the brow, 2 the chin, 3 the chest), drawn on both base
 * figures over a plain cap (a scalp), against the same cap without it.
 */
const SCALP: Piece = {
  scalp: {
    from: [
      [0, 0.5],
      [0.5, 0.5],
      [0.7, 0.4],
      [1.2, 0.34],
      [1.9, 0.3],
      [3.1416, 0.14],
    ],
    lift: 0.06,
    edge: 0.35,
    crown: 0.03,
    ridges: [9, 0.08],
    comb: 'back',
    sheen: { count: 14, from: 0.45, to: 0.95 },
  },
} as Piece
const fringeOf = (extra: Record<string, unknown> = {}): Piece =>
  ({
    fringe: {
      from: [
        [0, 0.5],
        [0.7, 0.45],
        [1.1, 0.3],
      ],
      width: 0.75,
      length: 1,
      count: 9,
      rope: { r: 0.15 },
      ...extra,
    },
  }) as Piece
const style = (...pieces: Piece[]): HairStyle => ({
  about: 'a cap, and a fringe if one is given',
  finish: 'smooth',
  pieces: [SCALP, ...pieces],
})
const wear = (i: number, st: HairStyle | string, sliders: Record<string, unknown> = {}) => {
  const def = BASE[i].def,
    outfit = def.outfits.base.map((g: Garment) => ('hair' in g ? { ...g, style: st } : g))
  const out = dressed(outfit as Garment[], undefined, def)
  return { ...out, sliders: { ...def.sliders, ...sliders } }
}
type Wear = ReturnType<typeof wear>
/** A figure standing at `d` eighths of a turn, density `D`. */
function stand(def: Wear, d = 0, D = 2) {
  const cast = member(def, D),
    f = new Figure(cast)
  for (let i = 0; i < 3; i++) f.update(1 / 60, { facing: (d * Math.PI) / 4, moving: false, view: view() })
  return { f, w: cast.cell[0], h: cast.cell[1] }
}
type Stand = ReturnType<typeof stand>
const HAIR = (p: number) => p >= 2000 && p < 3000
/** The rows of the drawn eyes (a row above and below the eye line), and the columns across both. */
function eyeBox(s: Stand) {
  const st = (s.f as unknown as { faceStamp: { eyes: [[number, number], [number, number]]; eye: number } })
    .faceStamp
  return {
    y0: Math.round(Math.min(st.eyes[0][1], st.eyes[1][1])) - 1,
    y1: Math.round(Math.max(st.eyes[0][1], st.eyes[1][1])) + 1,
    x0: Math.floor(st.eyes[0][0] - st.eye / 2),
    x1: Math.ceil(st.eyes[1][0] + st.eye / 2),
  }
}
/** The number of hair texels on the eye rows, between the outer edges of the eyes. */
function hairOnEyes(s: Stand) {
  const { y0, y1, x0, x1 } = eyeBox(s)
  let n = 0
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (HAIR(s.f.g.part[y * s.w + x])) n++
  return n
}
/** The rows where two figures' surfaces differ (the G-buffer's depth), lowest and highest. */
function diffRows(a: Stand, b: Stand) {
  const A = a.f.g,
    B = b.f.g,
    rows: number[] = []
  for (let k = 0; k < A.w * A.h; k++)
    if (A.depth[k] !== B.depth[k] && !(Math.abs(A.depth[k] - B.depth[k]) <= 0.002))
      rows.push(Math.floor(k / A.w))
  return { top: Math.min(...rows), bottom: Math.max(...rows), n: rows.length }
}
const filled = (px: Uint8ClampedArray) => {
  let n = 0
  for (let i = 3; i < px.length; i += 4) if (px[i]) n++
  return n
}

describe('the fringe', () => {
  for (const i of [0, 1]) {
    it(`${BASE[i].def.id}: a fringe of length 1 changes the cell, and only above the eye row`, () => {
      const a = stand(wear(i, style())),
        b = stand(wear(i, style(fringeOf({ length: 1 })))),
        rows = diffRows(a, b)
      expect(rows.n).toBeGreaterThan(0)
      expect(rows.bottom).toBeLessThan(eyeBox(a).y0)
    })
    it(`${BASE[i].def.id}: to length 1 no texel of the eye row is hair, at D1 and D2, with the head, brow and eye sliders at both ends`, () => {
      const cases: Record<string, unknown>[] = [{}]
      for (const v of [0, 1]) {
        cases.push(
          { head: v },
          { headWidth: v },
          { face: { ...BASE[i].def.sliders.face, browHeight: v } },
          { face: { ...BASE[i].def.sliders.face, eyeSize: v } },
        )
      }
      for (const length of [0, 0.5, 1])
        for (const sliders of cases)
          for (const D of [1, 2]) {
            expect(
              hairOnEyes(stand(wear(i, style(fringeOf({ length })), sliders), 0, D)),
              `length ${length} D${D} ${JSON.stringify(sliders).slice(0, 40)}`,
            ).toBe(0)
          }
    })
    it(`${BASE[i].def.id}: length 2 and 3 cover the eyes and keep clear of the head and the trunk in rest space`, () => {
      for (const length of [2, 3]) {
        const def = wear(i, style(fringeOf({ length, count: 11 }))),
          m = measure(def.sliders),
          s = skeleton(m.genes),
          form = headForm(m, s)
        expect(hairOnEyes(stand(def)), `length ${length}: the eyes are covered`).toBeGreaterThan(0)
        const garments = def.outfits[def.default] as Garment[],
          base = dress(
            m,
            s,
            def.skin,
            garments.map((g) => ('hair' in g ? { ...g, style: style() } : g)),
            { ...SWATCHES, ...def.swatches },
          ),
          look = dress(m, s, def.skin, garments, { ...SWATCHES, ...def.swatches })
        const mine = look.parts.slice(base.parts.length),
          trunk = look.parts.filter((p) => p.group === GROUP.torso),
          head = s.rest[J.head]
        expect(mine.length, `length ${length}: the fringe's parts`).toBeGreaterThan(0)
        for (const p of mine)
          for (let n = 0; n < p.mesh.positions.length; n += 3) {
            const v: [number, number, number] = [
                p.mesh.positions[n],
                p.mesh.positions[n + 1],
                p.mesh.positions[n + 2],
              ],
              inHead: [number, number, number] =
                p.bone === undefined ? [v[0] - head[0], v[1] - head[1], v[2] - head[2]] : v
            expect(insideHead(form, inHead), `length ${length}: a vertex inside the head`).toBe(false)
            if (v[1] > s.shoulderY - 0.02) continue
            const f = reach(trunk, s.rest, [v[0], v[1], 0], [0, 0, 1]),
              b = reach(trunk, s.rest, [v[0], v[1], 0], [0, 0, -1])
            if (f > 0 && b > 0)
              expect(v[2] >= f || v[2] <= -b, `length ${length}: a vertex inside the trunk`).toBe(true)
          }
      }
    })
  }
  it('sweep combs the fringe to a side: −1, 0 and 1 differ, and its clumps lean the one way and the other', () => {
    const at = (sweep: number) => {
      const s = stand(wear(1, style(fringeOf({ sweep, length: 1 })))),
        { y0 } = eyeBox(s)
      let sum = 0,
        n = 0
      for (let y = 0; y < y0; y++)
        for (let x = 0; x < s.w; x++)
          if (HAIR(s.f.g.part[y * s.w + x]) && y > y0 - 12) {
            sum += x
            n++
          }
      return { s, mean: sum / n }
    }
    const [l, c, r] = [at(-1), at(0), at(1)]
    expect(differs(l.s.f.painted, c.s.f.painted)).toBe(true)
    expect(differs(r.s.f.painted, c.s.f.painted)).toBe(true)
    expect(Math.sign(r.mean - c.mean)).toBe(-Math.sign(l.mean - c.mean))
    expect(Math.abs(r.mean - c.mean)).toBeGreaterThan(0.2)
  })
  it('is a base piece: a name a fork cannot take', () => {
    expect(() => registerHairPiece('fringe', { build: () => undefined })).toThrow('registered already')
  })
})

describe('the styles bob, bobFringe and longFront', () => {
  const NAMES = ['bob', 'bobFringe', 'longFront']
  it('are in the library, each described plainly', () => {
    for (const name of NAMES) {
      const st = HAIR_STYLES[name]
      expect(st, name).toBeDefined()
      expect(st.about.length).toBeGreaterThan(30)
      expect(st.about).not.toMatch(/Ada|Nurse|Voss/)
    }
  })
  it('build and paint on both base figures in all 8 views, standing, and in the walk', () => {
    for (const i of [0, 1])
      for (const name of NAMES) {
        for (let d = 0; d < 8; d++)
          expect(
            filled(stand(wear(i, name), d).f.painted),
            `${BASE[i].def.id} ${name} view ${d}`,
          ).toBeGreaterThan(400)
      }
  })
  it('build at every slider end (density 1, the front and the back)', () => {
    for (const name of NAMES)
      for (const key of BODY)
        for (const v of endsOf(key))
          for (const d of [0, 4]) {
            expect(
              filled(stand(wear(1, name, { [key]: v } as Partial<Sliders>), d, 1).f.painted),
              `${name} ${key}=${v} view ${d}`,
            ).toBeGreaterThan(150)
          }
  }, 240_000)
  it('bobFringe is the bob with a fringe: it differs from the bob', () => {
    expect(differs(stand(wear(1, 'bobFringe')).f.painted, stand(wear(1, 'bob')).f.painted)).toBe(true)
  })
})

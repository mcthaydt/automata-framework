import { describe, expect, it } from 'vitest'
import { BASE } from '#src/shared/base/base-pair.ts'
import { measure } from '#src/shared/body/genes.ts'
import type { Material } from '#src/shared/body/parts.ts'
import { J, skeleton } from '#src/shared/body/rig.ts'
import { Figure } from '#src/shared/figure/figure.ts'
import { member, view } from '#src/shared/figure/frames.ts'
import {
  HAIR_STYLES,
  type HairInput,
  type HairStyle,
  hairParts,
  type Piece,
  PPM,
  skull,
} from '#src/shared/hair/hair.ts'
import { type Garment, SWATCHES } from '#src/shared/outfit/garments.ts'
import { differs, dressed } from '../../fixtures/draw'

/**
 * A full bob (hair.ts `Scalp`): a shell that reaches down to the jaw and out to the width of a head and a fifth, with a
 * crown that stays a row or two over the skull, a hem that turns under, no tail and a parting. Each option is drawn on the
 * base woman against the same scalp without it; the library's `bobFull` is held to the numbers an artist's reference gives
 * (about 1 to 2 rows over the skull, 1.2 heads wide). Measured on the G-buffer and the painted cell, at density 2.
 */
const SCALP = {
  from: [
    [0, 0.5],
    [0.6, 0.45],
    [1, -0.2],
    [1.4, -0.6],
    [2.3, -0.6],
    // biome-ignore lint/suspicious/noApproximativeNumericConstant: a knot as written in the library; Math.PI is 7e-6 away and would move the curve
    [3.1416, -0.55],
  ],
  lift: 0.03,
  crown: 0.01,
  ridges: [9, 0.05],
  comb: 'back',
}
const FOOT = {
  foot: [
    [0, 0.05],
    [1, 0.5],
    // biome-ignore lint/suspicious/noApproximativeNumericConstant: as above
    [3.1416, 0.5],
  ],
  reach: 0.8,
}
const style = (scalp: Record<string, unknown> = {}): HairStyle => ({
  about: 'a scalp reaching to the jaw, and the option under test if one is given',
  finish: 'smooth',
  pieces: [{ scalp: { ...SCALP, ...scalp } } as Piece],
})
const woman = BASE[1].def
const wear = (st: HairStyle | string | null, sliders: Record<string, unknown> = {}) => {
  const outfit = woman.outfits.base
      .filter((g: Garment) => st !== null || !('hair' in g))
      .map((g: Garment) => ('hair' in g ? { ...g, style: st } : g)),
    out = dressed(outfit as Garment[], undefined, woman)
  return { ...out, sliders: { ...woman.sliders, ...sliders } }
}
type Wear = ReturnType<typeof wear>
/** A figure standing at `d` eighths of a turn, density 2. */
function stand(def: Wear, d = 0, D = 2) {
  const cast = member(def, D),
    f = new Figure(cast)
  for (let i = 0; i < 3; i++) f.update(1 / 60, { facing: (d * Math.PI) / 4, moving: false, view: view() })
  return { f, w: cast.cell[0], h: cast.cell[1], head: measure(def.sliders).genes.head * PPM * (D / 2) }
}
type Stand = ReturnType<typeof stand>
const HAIR = (p: number) => p >= 2000 && p < 3000
/** Per row: the texels drawn, and the hair's extent. */
function rows(s: Stand) {
  const out: { y: number; hair: number; x0: number; x1: number }[] = []
  for (let y = 0; y < s.h; y++) {
    let hair = 0,
      x0 = Number.POSITIVE_INFINITY,
      x1 = -1
    for (let x = 0; x < s.w; x++)
      if (s.f.painted[(y * s.w + x) * 4 + 3] && HAIR(s.f.g.part[y * s.w + x])) {
        hair++
        x0 = Math.min(x0, x)
        x1 = x
      }
    if (hair) out.push({ y, hair, x0, x1 })
  }
  return out
}
const top = (s: Stand) => {
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (s.f.painted[(y * s.w + x) * 4 + 3]) return y
  return -1
}
/** How far the hair stands above the bare skull, in rows. */
const rowsOver = (st: HairStyle | string, d = 0) => top(stand(wear(null), d)) - top(stand(wear(st), d))
/** The hair's widest row, in head heights. */
const widest = (st: HairStyle | string, d = 0) => {
  const s = stand(wear(st), d)
  return Math.max(...rows(s).map((r) => r.x1 - r.x0 + 1)) / s.head
}

describe('a scalp that reaches the jaw', () => {
  it('foot swells the hem: the hair is wider, and the crown does not move', () => {
    const plain = style(),
      full = style(FOOT)
    expect(widest(full)).toBeGreaterThan(widest(plain) + 0.1)
    expect(top(stand(wear(full)))).toBe(top(stand(wear(plain))))
  })
  it('foot at its default is the plain scalp: naming reach .25 draws the same cells', () => {
    const a = stand(wear(style())).f.painted,
      b = stand(wear(style({ reach: 0.25 }))).f.painted
    expect(differs(a, b)).toBe(false)
  })
  it('under turns the hem under: the shell’s lowest ring lies on the head, not standing off it', () => {
    // The shell's first part, its first ring (56 points round): how far each stands from the skull's own axis, on average.
    const m = measure(woman.sliders),
      s = skeleton(m.genes),
      k = skull(s)
    const ring = (st: HairStyle) => {
      const input: HairInput = {
          m,
          s,
          hair: 'hairBlack',
          skin: woman.skin,
          swatch: (n: string): Material => SWATCHES[n],
        },
        pos = hairParts(input, st).parts[0].mesh.positions
      let sum = 0
      for (let j = 0; j < 56; j++)
        sum += Math.hypot(
          pos[j * 3] + s.rest[J.head][0] - k.c[0],
          pos[j * 3 + 2] + s.rest[J.head][2] - k.c[2],
        )
      return sum / 56
    }
    expect(ring(style({ ...FOOT, under: 0.12 }))).toBeLessThan(ring(style(FOOT)) - 0.01)
  })
  it('a parting is a line of the hair’s deep step from the hairline to the crown, and only in the front view', () => {
    const a = stand(wear(style(FOOT))),
      b = stand(wear(style({ ...FOOT, parting: 0.1 })))
    expect(differs(a.f.painted, b.f.painted)).toBe(true)
    // The parting is hair, so the silhouette and the G-buffer's hair texels are unchanged.
    expect(rows(a).map((r) => r.hair)).toEqual(rows(b).map((r) => r.hair))
  })
})

describe('the library’s full bob', () => {
  const st = () => HAIR_STYLES.bobFull
  it('is in the library, described plainly', () => {
    expect(st()).toBeDefined()
    expect(st().about.length).toBeGreaterThan(30)
    expect(st().about).not.toMatch(/Ada|Nurse|Voss/)
  })
  it('stands a row or two over the skull, front, side and back', () => {
    for (const d of [0, 2, 4]) expect(rowsOver(st(), d), `view ${d}`).toBeLessThanOrEqual(2)
  })
  it('is about 1.2 heads wide at its widest, from the front and from behind', () => {
    for (const d of [0, 4]) {
      const w = widest(st(), d)
      expect(w, `view ${d}`).toBeGreaterThan(1.1)
      expect(w, `view ${d}`).toBeLessThan(1.3)
    }
  })
  it('has no tail: from behind its hem is as wide as the ears, to its last rows', () => {
    const s = stand(wear(st()), 4),
      r = rows(s),
      widthOf = (q: { x0: number; x1: number }) => q.x1 - q.x0 + 1,
      most = Math.max(...r.map(widthOf)),
      last = r[r.length - 1]
    expect(widthOf(r[r.length - 3]), 'two rows above its last').toBeGreaterThanOrEqual(0.7 * most)
    expect(last.hair).toBeGreaterThan(0.5 * most)
  })
  it('builds and paints on the base woman at every density, in all 8 views', () => {
    for (const D of [1, 2, 4])
      for (let d = 0; d < 8; d++)
        expect(rows(stand(wear(st()), d, D)).length, `D${D} view ${d}`).toBeGreaterThan(5)
  })
})

describe('the library’s round bob', () => {
  const st = () => HAIR_STYLES.bobRound
  it('is in the library, described plainly', () => {
    expect(st()).toBeDefined()
    expect(st()?.about.length).toBeGreaterThan(30)
    expect(st()?.about).not.toMatch(/Ada|Nurse|Voss/)
  })
  it('stands higher over the skull than the full bob, and is narrower at the hem, from the front', () => {
    expect(rowsOver(st(), 0)).toBeGreaterThan(rowsOver(HAIR_STYLES.bobFull, 0))
    expect(widest(st(), 0)).toBeLessThan(widest(HAIR_STYLES.bobFull, 0) - 0.05)
  })
  it('has more strand rows than the full bob, so it is not two flat tones', () => {
    const p = (n: string) =>
      (HAIR_STYLES[n].pieces[0] as { scalp: { ridges: [number, number] } }).scalp.ridges
    expect(p('bobRound')[0]).toBeGreaterThan(p('bobFull')[0])
  })
  it('builds and paints on the base woman at every density, in all 8 views', () => {
    for (const D of [1, 2, 4])
      for (let d = 0; d < 8; d++)
        expect(rows(stand(wear(st() as HairStyle), d, D)).length, `D${D} view ${d}`).toBeGreaterThan(5)
  })
})

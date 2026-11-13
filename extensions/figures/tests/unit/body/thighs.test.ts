import { describe, expect, it } from 'vitest'
import { BASE } from '#src/shared/base/base-pair.ts'
import { measure } from '#src/shared/body/genes.ts'
import { skeleton } from '#src/shared/body/rig.ts'
import type { CharacterDef } from '#src/shared/figure/cast.ts'
import { Figure } from '#src/shared/figure/figure.ts'
import { member, view } from '#src/shared/figure/frames.ts'
import { profiles } from '#src/shared/outfit/fit.ts'
import type { GBuffer } from '#src/shared/paint/raster.ts'

/**
 * Thighs: `Sliders.thighs`, 0–1, 0.5 today's legs. The leg's rings from the hip down to above the knee narrower (0) or fuller
 * (1), tapering to no change at the knee, each ring's centre moved in by what its half-width lost, so the inner edge, and so the
 * floor between the legs, stays where it was: from behind a slimmer pair of thighs, not a narrower stance.
 */
const withSliders = (def: CharacterDef, s: Record<string, number>): CharacterDef => ({
  ...def,
  sliders: { ...def.sliders, ...s },
})
/** A figure standing in view d at density 2: its painted frame. */
function drawn(def: CharacterDef, d: number) {
  const f = new Figure(member(def, 2))
  for (let i = 0; i < 3; i++) f.update(1 / 60, { facing: (d * Math.PI) / 4, moving: false, view: view() })
  const g = f.g as GBuffer
  return { px: f.painted.slice(), w: g.w, h: g.h }
}
/** Each row's silhouette: its first and last filled texel, and how many unfilled texels lie between them. */
function rows(o: ReturnType<typeof drawn>) {
  const out: { width: number; gaps: number }[] = []
  for (let y = 0; y < o.h; y++) {
    const xs: number[] = []
    for (let x = 0; x < o.w; x++) if (o.px[(y * o.w + x) * 4 + 3]) xs.push(x)
    if (!xs.length) {
      out.push({ width: 0, gaps: 0 })
      continue
    }
    const width = xs[xs.length - 1] - xs[0] + 1
    out.push({ width, gaps: width - xs.length })
  }
  return out
}
/** The silhouette's first and last rows. */
const span = (r: { width: number }[]) => {
  const ys = r.flatMap((o, y) => (o.width ? [y] : []))
  return [ys[0], ys[ys.length - 1]] as const
}
const frameDiffers = (a: Uint8ClampedArray, b: Uint8ClampedArray) =>
  Buffer.compare(Buffer.from(a), Buffer.from(b)) !== 0

describe('Measure.thighs is exactly the default at 0.5', () => {
  it('the factor is exactly 1 at 0.5 and when left out', () => {
    expect(measure({ thighs: 0.5 }).thighs).toBe(1)
    expect(measure({}).thighs).toBe(1)
  })
  it('the ends are a real range: 0.7 of the thigh at 0, 1.15 at 1', () => {
    expect(measure({ thighs: 0 }).thighs).toBeCloseTo(0.7, 9)
    expect(measure({ thighs: 1 }).thighs).toBeCloseTo(1.15, 9)
  })
})

describe('the leg rings at either end', () => {
  for (const { def } of BASE) {
    const legs = (s: Record<string, number>) => {
      const m = measure({ ...def.sliders, ...s })
      return profiles(m, skeleton(m.genes)).leg
    }
    it(`${def.id}: thighs 0.5 makes the very rings that leaving it out does`, () => {
      expect(legs({ thighs: 0.5 })).toEqual(legs({}))
    })
    for (const v of [0, 1])
      it(`${def.id} thighs ${v}: the inner edge of every ring holds, the outer edge moves at the hip, the knee and below are untouched`, () => {
        const o = legs({}),
          e = legs({ thighs: v })
        for (const [side, x] of [
          ['L', 1],
          ['R', -1],
        ] as const) {
          const a = o[side].rings,
            b = e[side].rings
          expect(b).toHaveLength(a.length)
          a.forEach((r, i) => {
            const inner = (q: typeof r) => (q.dx ?? 0) - x * q.rx
            expect(inner(b[i]), `${side} ring ${i} inner edge`).toBeCloseTo(inner(r), 12)
            expect(b[i].y).toBe(r.y)
          })
          // The two hip rings: a real change of girth, both ways.
          for (const i of [0, 1]) {
            const ratio = b[i].rx / a[i].rx
            if (v === 0) expect(ratio).toBeCloseTo(0.7, 9)
            else expect(ratio).toBeCloseTo(1.15, 9)
          }
          // The knee (ring 4) and everything under it.
          expect(b.slice(4)).toEqual(a.slice(4))
        }
      })
  }
})

describe('thighs drawn with and without it', () => {
  for (const { def } of BASE) {
    it(`${def.id}: thighs 0.5 paints every view exactly as leaving it out does`, () => {
      for (let d = 0; d < 8; d++)
        expect(
          frameDiffers(drawn(def, d).px, drawn(withSliders(def, { thighs: 0.5 }), d).px),
          `view ${d}`,
        ).toBe(false)
    })
    it(`${def.id}: from behind, thighs 0 is narrower across the hips and thighs than 0.5, and 1 wider; the floor between the legs holds`, () => {
      const at = (v: number) => rows(drawn(withSliders(def, { thighs: v }), 4)),
        o = at(0.5),
        [top, bottom] = span(o),
        h = bottom - top + 1,
        // The hips and thighs: a share of the figure's height, from the crotch's rise to above the knee.
        band = (r: { width: number }[]) =>
          Math.max(
            ...r.slice(top + Math.round(h * 0.45), top + Math.round(h * 0.62) + 1).map((q) => q.width),
          ),
        lo = at(0),
        hi = at(1)
      expect(band(o) - band(lo), `thighs 0: ${band(lo)} vs ${band(o)}`).toBeGreaterThanOrEqual(2)
      expect(band(hi) - band(o), `thighs 1: ${band(hi)} vs ${band(o)}`).toBeGreaterThanOrEqual(1)
      // Below the knee, the floor between the legs (the rows' gaps) is the same at both ends as at 0.5.
      const floor = (r: { gaps: number }[]) =>
        r.slice(top + Math.round(h * 0.7), top + Math.round(h * 0.92)).reduce((a, q) => a + q.gaps, 0)
      expect(floor(lo)).toBeGreaterThanOrEqual(floor(o))
      expect(floor(hi)).toBeGreaterThanOrEqual(floor(o) - 2)
    })
  }
})

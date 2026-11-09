import { describe, expect, it } from 'vitest'
import { type GBuffer, gbuffer, neckline } from '#src/features/figures/paint/raster.ts'

// The neckline rule: where the neck meets a top, a run of one or two texels (2·D at density D, at most 4) of the neck part
// hanging below the collar line, with the top on both sides and under it, joins the top, as a pixel artist removes a skin
// tooth from a shirt. It keys on the neck's parts only: a finger, a run too wide, a run with the background beside it are
// left alone.

interface Texel {
  part: number
  material: number
}
const TOP: Texel = { part: 0, material: 0 }
const NECK: Texel = { part: 1, material: 1 }
const FINGER: Texel = { part: 2, material: 1 }

const put = (g: GBuffer, x: number, y: number, t: Texel): void => {
  g.part[y * g.w + x] = t.part
  g.material[y * g.w + x] = t.material
}
const at = (g: GBuffer, x: number, y: number): Texel => ({
  part: g.part[y * g.w + x] ?? Number.NaN,
  material: g.material[y * g.w + x] ?? Number.NaN,
})

/** A buffer `w` wide with a top (part 0, material 0) from row 4 down and the background above. */
function shirt(w: number): GBuffer {
  const g = gbuffer(w, 8)
  g.part.fill(-1)
  g.material.fill(-1)
  g.group.fill(-1)
  for (let y = 4; y < 8; y++) for (let x = 0; x < w; x++) put(g, x, y, TOP)
  return g
}
/** The neck's texels at `row`, columns `from`..`to`, with the neck above them. */
function neckRun(g: GBuffer, row: number, from: number, to: number, t: Texel = NECK): void {
  for (let x = from; x <= to; x++) {
    put(g, x, row, t)
    put(g, x, row - 1, t)
  }
}

describe('neckline, on a hand-made G-buffer', () => {
  it('a 2-texel neck tooth into a top joins the top', () => {
    const g = shirt(64)
    neckRun(g, 4, 10, 11)
    neckline(g, new Set([1]))
    expect(at(g, 10, 4)).toEqual(TOP)
    expect(at(g, 11, 4)).toEqual(TOP)
    expect(at(g, 10, 3)).toEqual(NECK) // only the tooth, not the neck above it
  })
  it('a run of 2·D + 1 is left alone', () => {
    const g = shirt(64)
    neckRun(g, 4, 20, 22)
    neckline(g, new Set([1]))
    for (const x of [20, 21, 22]) expect(at(g, x, 4)).toEqual(NECK)
  })
  it('a run with the background on one side is left alone', () => {
    const g = shirt(64)
    neckRun(g, 4, 30, 31)
    put(g, 32, 4, { part: -1, material: -1 })
    neckline(g, new Set([1]))
    expect(at(g, 30, 4)).toEqual(NECK)
    expect(at(g, 31, 4)).toEqual(NECK)
  })
  it('a non-neck part (a finger) is never touched', () => {
    const g = shirt(64)
    neckRun(g, 4, 40, 41, FINGER)
    neckline(g, new Set([1]))
    expect(at(g, 40, 4)).toEqual(FINGER)
    expect(at(g, 41, 4)).toEqual(FINGER)
  })
  it('a peg two rows tall goes too, bottom-up', () => {
    const g = shirt(64)
    neckRun(g, 4, 50, 51)
    neckRun(g, 5, 50, 51) // neck at rows 3, 4 and 5
    neckline(g, new Set([1]))
    for (const x of [50, 51]) for (const y of [4, 5]) expect(at(g, x, y), `${x},${y}`).toEqual(TOP)
    expect(at(g, 50, 3)).toEqual(NECK)
  })
  it('a run under a different material is left alone', () => {
    const g = shirt(64)
    neckRun(g, 4, 5, 6)
    put(g, 5, 5, { part: 3, material: 2 })
    neckline(g, new Set([1]))
    expect(at(g, 5, 4)).toEqual(NECK)
  })
  it("at density 4 the run is capped at 4: a run of 4 joins and a run of 5 (the neck U's round bottom) does not", () => {
    const g = shirt(256)
    neckRun(g, 4, 10, 13)
    neckRun(g, 4, 30, 34)
    neckRun(g, 4, 50, 57)
    neckline(g, new Set([1]))
    for (let x = 10; x <= 13; x++) expect(at(g, x, 4)).toEqual(TOP)
    for (const [a, b] of [
      [30, 34],
      [50, 57],
    ] as const)
      for (let x = a; x <= b; x++) expect(at(g, x, 4), `${x}`).toEqual(NECK)
  })
  it('at density 2 a run of 4 joins and a run of 5 does not', () => {
    const g = shirt(128)
    neckRun(g, 4, 10, 13)
    neckRun(g, 4, 30, 34)
    neckline(g, new Set([1]))
    for (let x = 10; x <= 13; x++) expect(at(g, x, 4)).toEqual(TOP)
    for (let x = 30; x <= 34; x++) expect(at(g, x, 4)).toEqual(NECK)
  })
})

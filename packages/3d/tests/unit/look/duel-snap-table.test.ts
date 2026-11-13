// The snap's candidate table must give, for every colour that can reach the pass and every cell of the Bayer matrix, the
// palette colour the 256-colour loop gives: same distance rule, same first-index tie-break, same "a palette colour stays
// itself" rule. The loop is `referenceSnap`; the table's path is `tableSnap`. This file samples the cube densely; the
// exhaustive run over all 16,777,216 colours is `tests/slow/duel-snap-exhaustive.test.ts`.
import { describe, expect, it } from 'vitest'
import { BAYER } from '#src/features/look/duel-snap.ts'
import {
  candidateTable,
  GRID,
  referenceSnap,
  SHADER_PALETTE,
  tableSnap,
} from '#src/features/look/duel-snap-table.ts'

/** A small deterministic generator (mulberry32), so a failure names the same colour every run. */
function rng(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rgbOf = (r: number, g: number, b: number): [number, number, number] => [r / 255, g / 255, b / 255]

/** Colours that must come out the same: a lattice, every palette colour and its 26 neighbours, and random ones. */
function samples(step: number, random: number): [number, number, number][] {
  const out: [number, number, number][] = []
  for (let r = 0; r < 256; r += step)
    for (let g = 0; g < 256; g += step)
      for (let b = 0; b < 256; b += step) out.push(rgbOf(r, g, b), rgbOf(255 - r, g, b))
  for (const [pr, pg, pb] of SHADER_PALETTE) {
    const [r, g, b] = [Math.round(pr * 255), Math.round(pg * 255), Math.round(pb * 255)]
    for (let dr = -1; dr <= 1; dr++)
      for (let dg = -1; dg <= 1; dg++)
        for (let db = -1; db <= 1; db++)
          out.push(
            rgbOf(
              Math.min(255, Math.max(0, r + dr)),
              Math.min(255, Math.max(0, g + dg)),
              Math.min(255, Math.max(0, b + db)),
            ),
          )
  }
  const next = rng(7)
  for (let i = 0; i < random; i++)
    out.push(rgbOf(Math.floor(next() * 256), Math.floor(next() * 256), Math.floor(next() * 256)))
  out.push(rgbOf(0, 0, 0), rgbOf(255, 255, 255), rgbOf(255, 0, 0), rgbOf(0, 255, 0), rgbOf(0, 0, 255))
  return out
}

describe('the candidate table gives the loop its answer', () => {
  for (const [strength, step, random] of [
    [0, 31, 4000],
    [0.04, 11, 20_000],
    [0.13, 31, 4000],
    [0.5, 31, 4000],
  ] as const) {
    it(`at dither strength ${strength}, in every Bayer cell, for a dense sample of the colour cube`, () => {
      const table = candidateTable(strength)
      const wrong: string[] = []
      for (const rgb of samples(step, random))
        for (let cell = 0; cell < BAYER.length; cell++) {
          const want = referenceSnap(rgb, cell, strength)
          const got = tableSnap(table, rgb, cell, strength)
          if (got !== want && wrong.length < 5)
            wrong.push(`${rgb.map((v) => Math.round(v * 255))}@${cell}: ${got} not ${want}`)
        }
      expect(wrong).toEqual([])
    })
  }

  it('leaves every palette colour as itself in every Bayer cell, at the strengths a look can name', () => {
    for (const strength of [0, 0.04, 1]) {
      const table = candidateTable(strength)
      SHADER_PALETTE.forEach((colour, index) => {
        for (let cell = 0; cell < BAYER.length; cell++)
          expect(tableSnap(table, colour, cell, strength)).toBe(index)
      })
    }
  })

  it("keeps each cell's candidates in palette order and within the palette", () => {
    const table = candidateTable(0.04)
    for (let cell = 0; cell < GRID ** 3; cell++) {
      const list = table.candidates(cell)
      expect(list.length).toBeGreaterThan(0)
      expect([...list].sort((a, b) => a - b)).toEqual([...list])
      expect(new Set(list).size).toBe(list.length)
      expect(Math.max(...list)).toBeLessThan(SHADER_PALETTE.length)
    }
  })

  it('is small: a few candidates a cell, not the palette', () => {
    const table = candidateTable(0.04)
    expect(table.maxCount).toBeLessThan(32)
    expect(table.data.byteLength).toBeLessThan(1 << 20)
  })

  it('is the same table for the same strength (built once)', () => {
    expect(candidateTable(0.04)).toBe(candidateTable(0.04))
  })
})

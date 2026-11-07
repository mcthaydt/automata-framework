// Lettering for signs: block capitals set into lines and built as geometry; the words a made-up sign uses come from the
// library's word list, never from code.
import { describe, expect, it } from 'vitest'
import { letterMesh, nameOf, setText, shopName, sizeOf, tubeMesh } from '#src/shared/lettering/lettering.ts'
import words from '../../../library/words.json' with { type: 'json' }

describe('lettering', () => {
  it('sets lines as rows of ink, each line centred', () => {
    const rows = setText(['AB', 'A'])
    const [width, height] = sizeOf(rows)
    expect(height).toBe(5 + 1 + 5)
    expect(rows.every((row) => row.length === width)).toBe(true)
    expect(rows[0]).toBe('###.##.')
  })

  it('makes a quad per run of ink, and tubes along the strokes', () => {
    const rows = setText(['I'])
    expect(letterMesh(rows, 0.05, 0).indices.length / 6).toBeGreaterThanOrEqual(rows.length)
    const tubes = tubeMesh(rows, 0.05, 0, 0.01)
    expect(tubes.positions.length).toBeGreaterThan(0)
    expect(tubes.positions.every(Number.isFinite)).toBe(true)
  })

  it('names a shop from its seed, the same each time, from the library’s own words', () => {
    expect(shopName(4)).toEqual(shopName(4))
    for (let seed = 0; seed < 40; seed++) {
      const lines = shopName(seed)
      expect(words.shopKinds).toContain(lines.at(-1))
      if (lines.length === 2) expect(lines[0]).toBe(nameOf(seed))
    }
  })

  it('makes a name only of syllables the word list has', () => {
    for (let seed = 0; seed < 40; seed++) {
      let rest = nameOf(seed)
      while (rest.length > 0) {
        const next = words.syllables.find((s) => rest.startsWith(s))
        expect(next, `${nameOf(seed)} breaks down into the list`).toBeDefined()
        rest = rest.slice((next as string).length)
      }
    }
  })
})

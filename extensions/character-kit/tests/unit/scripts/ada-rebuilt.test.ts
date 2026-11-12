// Ada rebuilt from the base woman and the generated images' look spec (`ada-look-spec.md`): her proportions, read from the picture at
// density 2, are the turnaround's within a hand's breadth, and her eyes are drawn there. Written against the sheet's table (`figure-rebuild.ts`).
import { describe, expect, it } from 'vitest'
import { paintedCell, proportions } from '#src/entries/testing.ts'
import { LOOKS } from '../../../scripts/ada-rebuilt.ts'

const adopted = (LOOKS['round8-ada'] ?? []).find((v) => v.label.includes('ADOPTED'))

describe('the rebuilt Ada', () => {
  it('has an adopted version', () => {
    expect(adopted).toBeDefined()
  })

  it('is about seven heads tall with her hair on (the turnaround: 6.8), legs half her height (50.6 %)', () => {
    if (adopted === undefined) return
    const p = proportions(adopted.def, 2)
    expect(p.headsWithHair).toBeGreaterThan(6.4)
    expect(p.headsWithHair).toBeLessThan(7.3)
    expect(p.legRows / p.height).toBeGreaterThan(0.48)
    expect(p.legRows / p.height).toBeLessThan(0.53)
  })

  it('is 162 cm and about 125 rows tall at density 2', () => {
    if (adopted === undefined) return
    expect(adopted.def.sliders.height).toBe(162)
    expect(proportions(adopted.def, 2).height).toBeGreaterThan(118)
    expect(proportions(adopted.def, 2).height).toBeLessThan(132)
  })

  it('shows two eyes from the front at density 2: a dark texel with the white of the eye either side, twice on one row, 4 to 14 apart', () => {
    if (adopted === undefined) return
    const cell = paintedCell(adopted.def, 0, 2)
    const [w, h] = cell.size
    const p = cell.painted
    const lum = (i: number) => 0.3 * (p[i * 4] ?? 0) + 0.59 * (p[i * 4 + 1] ?? 0) + 0.11 * (p[i * 4 + 2] ?? 0)
    const opaque = (i: number) => (p[i * 4 + 3] ?? 0) > 0
    const eye = (i: number) =>
      opaque(i) && lum(i) < 60 && opaque(i - 1) && lum(i - 1) > 200 && opaque(i + 1) && lum(i + 1) > 200
    let found = false
    for (let y = 1; y < h / 2 && !found; y++)
      for (let a = 1; a < w - 1 && !found; a++)
        for (let b = a + 4; b <= a + 14 && b < w - 1; b++) if (eye(y * w + a) && eye(y * w + b)) found = true
    expect(found).toBe(true)
  })
})

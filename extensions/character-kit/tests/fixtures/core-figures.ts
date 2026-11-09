// The figures core draws without the kit: Wick (the fixture figure) and the base pair, built to the fingerprints of their
// parts. `tests/fixtures/core-figures.json` is this, recorded by scripts/record-core-figures.ts in a process that never
// loads the kit; the tests build the same figures with the kit loaded and without it, and both must match the recording.

import { BASE_PAIR, BASE_PAIR_SWATCHES } from '@automata/3d/base'
import { build, type FigureDef, type FigureLibrary, skeleton } from '@automata/3d/figures'
import { fingerprint, fixtureFigures } from '@automata/3d/testing'
import { expect } from 'vitest'

/** `x` with every number kept to 13 significant digits, as the geometry goldens are. */
const round = (x: unknown): unknown => {
  if (typeof x === 'number') return Number(x.toPrecision(13))
  if (Array.isArray(x)) return x.map(round)
  if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, round(v)]))
  return x
}

const digest = (def: FigureDef, library: FigureLibrary): unknown[] =>
  build(def, skeleton(def), def.default, null, library).parts.map((p) => round(fingerprint(p)))

/** The fingerprints of every part of Wick, the base man and the base woman, by who. */
export async function coreFigureDigests(): Promise<Record<string, unknown[]>> {
  const fixture = await fixtureFigures()
  const wick = fixture.figures.wick
  if (!wick) throw new Error('the fixture has no Wick')
  const pair: FigureLibrary = { swatches: BASE_PAIR_SWATCHES, hair: {}, headwear: {}, items: {} }
  return {
    wick: digest(wick, fixture.library),
    man: digest(BASE_PAIR.man, pair),
    woman: digest(BASE_PAIR.woman, pair),
  }
}

/** `actual` is `expected` with every number within 1e-9 (relative past 1), the goldens' tolerance. */
export function expectClose(actual: unknown, expected: unknown, what = 'digest'): void {
  if (typeof expected === 'number') {
    expect(typeof actual, what).toBe('number')
    expect(Math.abs((actual as number) - expected), `${what}: ${actual} vs ${expected}`).toBeLessThanOrEqual(
      1e-9 * Math.max(1, Math.abs(expected)),
    )
  } else if (Array.isArray(expected)) {
    expect(Array.isArray(actual) && actual.length, what).toBe(expected.length)
    for (const [i, v] of expected.entries()) expectClose((actual as unknown[])[i], v, `${what}[${i}]`)
  } else if (expected && typeof expected === 'object') {
    expect(Object.keys(actual as object).sort(), what).toEqual(Object.keys(expected).sort())
    for (const [k, v] of Object.entries(expected))
      expectClose((actual as Record<string, unknown>)[k], v, `${what}.${k}`)
  } else expect(actual, what).toEqual(expected)
}

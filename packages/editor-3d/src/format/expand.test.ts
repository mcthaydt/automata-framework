// The four shipped blockout files against what the original generator's own `expand` produced (the golden recorded once);
// the openings and nav cases live with the format, in `@automataframework/automata-sector-format`.
import { describe, expect, it } from 'vitest'
import { loadFixture, loadGolden } from '../testing/fixtures'
import type { Blockout } from './blockout.schema'
import { expand } from './expand'

describe('expand against the shipped files', () => {
  const GOLDEN = JSON.parse(loadGolden('expand')) as Record<string, unknown>
  for (const name of [
    'blockout-clinic',
    'blockout-clinic-dawn',
    'blockout-bay',
    'blockout-prologue',
  ] as const) {
    it(`${name}: expands to exactly what the original generator's expand produced (sectors, nav, everything)`, () => {
      const expanded = expand(JSON.parse(loadFixture(name)) as Blockout)
      // JSON round trip: the golden is JSON, which writes -0 as 0.
      expect(JSON.parse(JSON.stringify(expanded))).toEqual(GOLDEN[name])
    })
  }
})

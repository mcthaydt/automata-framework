import { describe, expect, it } from 'vitest'
import { BASE } from '#src/shared/base/base-pair.ts'
import { Figure } from '#src/shared/figure/figure.ts'
import { member } from '#src/shared/figure/frames.ts'

/**
 * Every base figure builds at every density a stage asks for. Some hair pieces only grow parts at close-up densities
 * (a tail's cuffs from 1.5×), so a material they name that the library lacks shows only there: no golden draws that close.
 */
describe('base figures at every density', () => {
  for (const { def } of BASE)
    for (const density of [1, 2, 3, 4]) {
      it(`${def.id} builds at density ${density}`, () => {
        expect(() => new Figure(member(def, density))).not.toThrow()
      })
    }
})

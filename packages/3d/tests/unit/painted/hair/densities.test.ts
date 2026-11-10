import { describe, expect, it, vi } from 'vitest'
import { BASE } from '#src/features/painted/base/base.ts'
import { Figure } from '#src/features/painted/figure/figure.ts'
import { member } from '#src/features/painted/figure/frames.ts'

// Each case paints whole figures, seconds apiece with the suite's files side by side; the source's own suite allows
// 30 s, and so does this file.
vi.setConfig({ testTimeout: 30_000 })

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

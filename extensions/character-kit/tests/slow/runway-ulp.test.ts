// Every runway cell under the last bit of the maths, by hand: all 112 cells (eight models in four directions on their own bodies,
// and on the fit check's five bodies in three directions), eight seeds each, about four minutes. The unit test of the same name
// (`tests/unit/fashion/ulp.test.ts`) tries the five cells that were unstable before the builder's pole rule.
//
//   pnpm --filter @automataframework/character-kit test:slow

import { nudged } from '@automataframework/vitest-preset/ulp'
import { describe, expect, it } from 'vitest'
import { registerFashion } from '#src/features/fashion/register-fashion.ts'
import { RUNWAY_CAST } from '#src/features/fashion/runway-cast.ts'
import { member, standing } from '#src/shared/figures/door.ts'
import { cellMd5 } from '../fixtures/cell-miss.ts'
import { RUNWAY_GOLDEN } from '../fixtures/runway-golden.ts'

registerFashion()

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8]

describe('every runway cell under the last bit of the maths', () => {
  for (const { def } of RUNWAY_CAST) {
    it(`${def.id}: every cell is the same whatever the last bit of the maths`, () => {
      const moved: string[] = []
      const cells: { label: string; paint: () => ReturnType<typeof standing> }[] = []
      for (const direction of RUNWAY_GOLDEN.directions)
        cells.push({
          label: `${def.id}/own/${direction}`,
          paint: () => standing(member(def, RUNWAY_GOLDEN.density), direction),
        })
      for (const [body, sliders] of Object.entries(RUNWAY_GOLDEN.bodies))
        for (const direction of RUNWAY_GOLDEN.fitDirections)
          cells.push({
            label: `${def.id}/${body}/${direction}`,
            paint: () =>
              standing(
                member(
                  { ...def, id: `${def.id}-fit`, sliders: { ...def.sliders, ...sliders } },
                  RUNWAY_GOLDEN.density,
                ),
                direction,
              ),
          })
      for (const { label, paint } of cells) {
        const plain = cellMd5(paint())
        for (const seed of SEEDS) {
          const got = cellMd5(nudged(seed, paint))
          if (got !== plain) moved.push(`${label} seed ${seed}: ${got}, not ${plain}`)
        }
      }
      expect(moved, `${moved.length} nudged cells differ`).toEqual([])
    }, 600_000)
  }
})

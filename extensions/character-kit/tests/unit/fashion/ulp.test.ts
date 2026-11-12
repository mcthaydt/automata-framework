// The runway cells are the same whatever the last bit of the maths. On arm64 `nia` on the thin body, direction 0, painted two
// texels differently (the old `ARCH_OVERRIDES` entry): the builder's hair grid turned a pole's normal by the sign of a
// rounding-sized offset, so a last bit of `Math.sin` or `Math.cos` flipped it. This nudges the maths a last bit (the way a
// library built with fused multiply-add differs) and checks that the cells do not change. It proves stability against that, not
// that there is no other arch difference: only a Mac's run does (the `checks` job).
import { describe, expect, it } from 'vitest'
import { registerFashion } from '#src/features/fashion/register-fashion.ts'
import { RUNWAY_CAST } from '#src/features/fashion/runway-cast.ts'
import { member, standing } from '#src/shared/figures/door.ts'
import { cellMd5 } from '../../fixtures/cell-miss.ts'
import { RUNWAY_GOLDEN } from '../../fixtures/runway-golden.ts'
import { nudged } from '../../fixtures/ulp.ts'

registerFashion()

/** Seeds tried a cell: eight, so the job stays short (`tests/slow/` tries every cell by hand). */
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8]

/** The cells that were unstable on the builder at `d6e3c9f` (found by nudging all 112): `<model>/<body>/<direction>`, the
 * body `own` for the model's own. `nia/thin/0` is the one the Macs painted differently. */
const UNSTABLE: readonly [string, string, number][] = [
  ['nia', 'thin', 0],
  ['nia', 'own', 0],
  ['june', 'own', 3],
  ['june', 'muscular', 5],
  ['june', 'curvy', 5],
]

/** The painted cell of `model` on `body`, standing in `direction`, as the golden's tests paint it. */
function paint(model: string, body: string, direction: number) {
  const entry = RUNWAY_CAST.find((m) => m.def.id === model)
  if (entry === undefined) throw new Error(`the runway has no ${model}`)
  const def =
    body === 'own'
      ? entry.def
      : { ...entry.def, id: `${model}-fit`, sliders: { ...entry.def.sliders, ...RUNWAY_GOLDEN.bodies[body] } }
  return standing(member(def, RUNWAY_GOLDEN.density), direction)
}

describe('the runway cells under the last bit of the maths', () => {
  it('the runway cells are the same whatever the last bit of the maths', () => {
    const moved: string[] = []
    for (const [model, body, direction] of UNSTABLE) {
      const plain = cellMd5(paint(model, body, direction))
      for (const seed of SEEDS) {
        const got = cellMd5(nudged(seed, () => paint(model, body, direction)))
        if (got !== plain) moved.push(`${model}/${body}/${direction} seed ${seed}: ${got}, not ${plain}`)
      }
    }
    expect(moved, `${moved.length} nudged cells differ from the plain cell`).toEqual([])
  }, 120_000)
})

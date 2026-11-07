import { describe, expect, it } from 'vitest'
import { vertexAt } from '#src/features/figures/body/mesh.ts'
import type { Rope } from '#src/features/figures/content/hair.schema.ts'
import { sweep } from '#src/features/figures/hair/sweep.ts'
import type { V3 } from '#src/shared/math/math.ts'

describe('sweep', () => {
  // M3.5b decision 16. The source's tip, `1 - q²` with `q = (t - (1 - tipLen)) / tipLen`, left the last ring
  // about 1e-10 m wide whenever `q` rounded to just under 1 at t = 1 (here: a tip 0.1 of the way, since
  // 1 - 0.9 is 0.09999999999999998), so that ring's normals took their side from the sign of a dot product
  // with that 1e-10 m offset. Whether it rounded so turned on the last bit of the path's length, which
  // differs between platforms.
  const path: V3[] = [
    [0, 0, 0],
    [0, 0.5, 0],
    [0, 1, 0],
  ]
  const seg = 10
  for (const tip of ['round', 'blunt', 'point'] as const)
    it(`closes a ${tip} tip on one point, as the root`, () => {
      const rope: Rope = { r: 0.1, tip, seg }
      const { mesh } = sweep(path, rope, 1, () => [0, 0, 1])
      const rings = mesh.positions.length / 3 / seg
      for (const ring of [0, rings - 1]) {
        const centre = vertexAt(mesh.positions, ring * seg)
        for (let j = 1; j < seg; j++)
          expect(vertexAt(mesh.positions, ring * seg + j), `ring ${ring}`).toEqual(centre)
      }
    })
})

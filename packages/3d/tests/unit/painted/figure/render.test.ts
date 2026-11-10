import { describe, expect, it, vi } from 'vitest'
import { BASE } from '#src/features/painted/base/base.ts'
import { fromDef } from '#src/features/painted/figure/cast.ts'
import { Figure } from '#src/features/painted/figure/figure.ts'

// Each case paints whole figures, seconds apiece with the suite's files side by side; the source's own suite allows
// 30 s, and so does this file.
vi.setConfig({ testTimeout: 30_000 })

describe('the base pair', () => {
  for (const c of BASE)
    it(`${c.def.id} paints a figure in every direction`, () => {
      const member = fromDef(c.def)
      for (let d = 0; d < 8; d++) {
        const f = new Figure(member)
        f.update(1 / 60, { facing: (d * Math.PI) / 4, moving: false, view: { azimuth: 0, pitch: 0.3 } })
        let filled = 0
        for (let i = 3; i < f.painted.length; i += 4) if (f.painted[i]) filled++
        expect(filled).toBeGreaterThan(400)
      }
    })
})

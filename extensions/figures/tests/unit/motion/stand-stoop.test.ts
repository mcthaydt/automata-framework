import { describe, expect, it } from 'vitest'
import { BASE } from '#src/shared/base/base-pair.ts'
import { Figure } from '#src/shared/figure/figure.ts'
import { member, view } from '#src/shared/figure/frames.ts'
import type { Gait } from '#src/shared/motion/motion.ts'

/**
 * A stooping stand (motion.ts `Gait.standStoop`): the relaxed stand's chest pitched forward by this many radians, the head
 * coming up half as far to keep its eyes ahead. Standing, from the side: the head stands further forward, and lower from a deep lean. At its default, nothing is pitched and the stand is as it always was.
 */
const woman = BASE[1].def
function side(over: Partial<Gait>, D = 2) {
  const cast = member({ ...woman, gaitOverrides: over }, D),
    f = new Figure(cast)
  for (let i = 0; i < 3; i++) f.update(1 / 60, { facing: Math.PI / 2, moving: false, view: view() })
  const w = cast.cell[0],
    h = cast.cell[1]
  let top = -1,
    head = 0
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (f.painted[(y * w + x) * 4 + 3]) {
        if (top < 0) top = y
        // The head's reach: the frontmost texel over the figure's top fifth.
        if (y < top + 0.2 * (h * 0.4)) head = Math.max(head, Math.abs(x - w / 2))
      }
  return { top, head, px: f.painted.slice() }
}
describe('a stooping stand (standStoop)', () => {
  for (const D of [1, 2])
    it(`carries the head forward, and a deep stoop lowers it (density ${D})`, () => {
      const plain = side({}, D),
        stoop = side({ standStoop: 0.35 }, D),
        deep = side({ standStoop: 0.7 }, D)
      expect(stoop.head, 'further forward').toBeGreaterThan(plain.head + 1)
      expect(deep.head).toBeGreaterThan(stoop.head)
      expect(deep.top, 'the head is lower').toBeGreaterThan(plain.top)
    })
  it('naming the default 0 draws the same cells', () => {
    expect(Buffer.compare(Buffer.from(side({}).px), Buffer.from(side({ standStoop: 0 }).px))).toBe(0)
  })
})

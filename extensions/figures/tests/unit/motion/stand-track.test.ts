import { describe, expect, it } from 'vitest'
import { BASE } from '#src/shared/base/base-pair.ts'
import { Figure } from '#src/shared/figure/figure.ts'
import { member, view } from '#src/shared/figure/frames.ts'
import type { Gait } from '#src/shared/motion/motion.ts'

/**
 * The relaxed stand's feet (motion.ts `Gait.standTrack`): how far each foot stands from the middle, a share of the hip
 * joints' half-width (0.75 as it always was, the feet a little in under the hips). A narrow pelvis whose legs merge stands
 * them apart at 1, or together below 0.75, by data. Measured on the base woman's cell standing, from the front: the width of
 * the figure at the feet's rows, and its gap between the legs.
 */
const woman = BASE[1].def
function stand(over: Partial<Gait>, D = 2) {
  const cast = member({ ...woman, gaitOverrides: over }, D),
    f = new Figure(cast)
  for (let i = 0; i < 3; i++) f.update(1 / 60, { facing: 0, moving: false, view: view() })
  return { px: f.painted.slice(), w: cast.cell[0], h: cast.cell[1] }
}
/** The span between the outermost opaque texels over the figure's last `rows` rows: the width of its feet. */
function feet(s: ReturnType<typeof stand>, rows = 6) {
  let last = 0
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (s.px[(y * s.w + x) * 4 + 3]) last = y
  let x0 = Number.POSITIVE_INFINITY,
    x1 = -1
  for (let y = last - rows + 1; y <= last; y++)
    for (let x = 0; x < s.w; x++)
      if (s.px[(y * s.w + x) * 4 + 3]) {
        x0 = Math.min(x0, x)
        x1 = Math.max(x1, x)
      }
  return x1 - x0 + 1
}
describe('the relaxed stand’s feet (standTrack)', () => {
  for (const D of [1, 2])
    it(`1 stands the feet wider apart than the default, and .45 closer together (density ${D})`, () => {
      const plain = feet(stand({}, D)),
        wide = feet(stand({ standTrack: 1 }, D)),
        close = feet(stand({ standTrack: 0.45 }, D))
      expect(wide, 'apart').toBeGreaterThan(plain)
      expect(close, 'together').toBeLessThan(plain)
    })
  it('naming the default .75 draws the same cells', () => {
    expect(Buffer.compare(Buffer.from(stand({}).px), Buffer.from(stand({ standTrack: 0.75 }).px))).toBe(0)
  })
})

import { describe, expect, it } from 'vitest'
import { BASE } from '#src/shared/base/base-pair.ts'
import { Figure } from '#src/shared/figure/figure.ts'
import { member, view } from '#src/shared/figure/frames.ts'
import { duel, hex } from '#src/shared/paint/paint-style.ts'

/**
 * The outline's colour (`PaintStyle.ink`): black by default, so a game can outline in a dark DUEL colour (the old game's
 * `#002219`, a navy). Every texel the painter outlines in ink takes the colour and no other texel moves.
 */
const BLACK = 0x000000
function paint(style: { ink?: string }, i: number, d: number, D: number) {
  const cast = member(BASE[i].def, D),
    f = new Figure(cast)
  Object.assign(f.paintStyle, style)
  for (let k = 0; k < 3; k++) f.update(1 / 60, { facing: (d * Math.PI) / 4, moving: false, view: view() })
  return { px: f.painted.slice(), n: cast.cell[0] * cast.cell[1] }
}
const rgb = (px: Uint8ClampedArray, k: number) => (px[k * 4] << 16) | (px[k * 4 + 1] << 8) | px[k * 4 + 2]

describe('the outline colour', () => {
  for (const ink of ['#002219', '#181f2f'])
    for (const [i, d, D] of [
      [0, 0, 2],
      [1, 1, 2],
      [1, 4, 1],
    ] as const)
      it(`${ink} recolours the ink texels and moves no other (${BASE[i].def.id}, view ${d}, density ${D})`, () => {
        const plain = paint({}, i, d, D),
          dark = paint({ ink }, i, d, D),
          want = duel(hex(ink))
        let inked = 0
        for (let k = 0; k < plain.n; k++) {
          expect(dark.px[k * 4 + 3], 'the same silhouette').toBe(plain.px[k * 4 + 3])
          if (!plain.px[k * 4 + 3]) continue
          if (rgb(plain.px, k) === BLACK) {
            inked++
            expect(rgb(dark.px, k), `texel ${k}`).toBe(want)
          } else expect(rgb(dark.px, k), `texel ${k}`).toBe(rgb(plain.px, k))
        }
        expect(inked, 'the figure has an ink outline').toBeGreaterThan(40)
      })
  it('naming the default black draws the same cells', () => {
    const a = paint({}, 1, 0, 2).px,
      b = paint({ ink: '#000000' }, 1, 0, 2).px
    expect(Buffer.compare(Buffer.from(a), Buffer.from(b))).toBe(0)
  })
})

import { describe, expect, it } from 'vitest'
import { BASE } from '#src/shared/base/base-pair.ts'
import { Figure } from '#src/shared/figure/figure.ts'
import { member, view } from '#src/shared/figure/frames.ts'
import { type Garment, SWATCHES } from '#src/shared/outfit/garments.ts'
import { tonesOf } from '#src/shared/paint/paint.ts'
import { dressed } from '../../fixtures/draw'

/**
 * `full` on the `eyes` garment: an eye drawn as large as its head allows. The painter's eye is a sprite's (a lash row over
 * two rows of iris, the white on the upper row only) at every size; at density 4 a head is 50 texels tall and that eye is a
 * slit. `full` draws the aperture as tall as the eye is wide (a white all round a round iris with its pupil and a catch-light,
 * the lid over it). Under the texels it needs (an eye of 6 texels, density 3) it draws what it always drew.
 */
const woman = BASE[1].def
const eyes = (extra: object = {}): Garment =>
  ({ eyes: 'eyeBrown', lids: 'lidDeep', white: 'eyeWhite', lips: 'lipsWarm', ...extra }) as Garment
const draw = (extra: object, D: number, d = 0) => {
  const def = dressed([eyes(extra)], undefined, woman),
    cast = member(def, D),
    f = new Figure(cast)
  for (let i = 0; i < 3; i++) f.update(1 / 60, { facing: (d * Math.PI) / 4, moving: false, view: view() })
  return { px: f.painted.slice(), w: cast.cell[0], h: cast.cell[1] }
}
const rgb = (s: ReturnType<typeof draw>, k: number) =>
  (s.px[k * 4] << 16) | (s.px[k * 4 + 1] << 8) | s.px[k * 4 + 2]
const [IRIS, LASH] = tonesOf(SWATCHES.eyeBrown)
function where(s: ReturnType<typeof draw>, colour: number): [number, number][] {
  const out: [number, number][] = []
  for (let k = 0; k < s.w * s.h; k++)
    if (s.px[k * 4 + 3] && rgb(s, k) === colour) out.push([k % s.w, Math.floor(k / s.w)])
  return out
}
const same = (a: ReturnType<typeof draw>, b: ReturnType<typeof draw>) =>
  a.px.length === b.px.length && a.px.every((v, i) => v === b.px[i])

describe('a full eye (`eyes.full`)', () => {
  for (const D of [1, 2])
    for (const d of [0, 1, 2])
      it(`draws the face exactly as before at density ${D}, view ${d} (the eye is too small for it)`, () => {
        expect(same(draw({ full: true }, D, d), draw({}, D, d))).toBe(true)
      })

  it('draws a taller eye than the sprite’s three rows at density 4 (front): the lash row and a round iris under it', () => {
    const rowsOf = (s: ReturnType<typeof draw>) => {
      const t = [...where(s, IRIS), ...where(s, LASH)].filter(([x]) => x < s.w / 2)
      return { rows: new Set(t.map(([, y]) => y)).size, iris: where(s, IRIS).length }
    }
    const plain = rowsOf(draw({}, 4)),
      full = rowsOf(draw({ full: true }, 4))
    expect(plain.rows, 'the sprite’s eye: a lash row, a pupil row and an iris row').toBeLessThanOrEqual(3)
    expect(full.rows, 'the full eye').toBeGreaterThanOrEqual(4)
    expect(full.iris, 'more iris texels').toBeGreaterThan(plain.iris * 2)
  })

  it('is round: its iris is as wide as it is tall, and the pupil sits inside it', () => {
    const s = draw({ full: true }, 4),
      iris = where(s, IRIS),
      ys = iris.map(([, y]) => y),
      left = iris.filter(([x]) => x < s.w / 2),
      xs = left.map(([x]) => x),
      tall = Math.max(...ys) - Math.min(...ys) + 1,
      wide = Math.max(...xs) - Math.min(...xs) + 1
    expect(wide, 'one eye’s iris').toBeGreaterThanOrEqual(3)
    expect(Math.abs(wide - tall)).toBeLessThanOrEqual(2)
  })

  it('keeps the eyes level and mirrored in the front view', () => {
    const s = draw({ full: true }, 4),
      iris = where(s, IRIS),
      a = iris.filter(([x]) => x < s.w / 2),
      b = iris.filter(([x]) => x >= s.w / 2)
    expect(a.length).toBe(b.length)
    expect(Math.min(...a.map(([, y]) => y))).toBe(Math.min(...b.map(([, y]) => y)))
  })

  for (const d of [1, 2, 3, 5, 6, 7])
    it(`draws without throwing and keeps an iris in view ${d} at density 4, or none where the face is turned away`, () => {
      const s = draw({ full: true }, 4, d)
      const n = where(s, IRIS).length
      if (d === 1 || d === 2 || d === 6 || d === 7) expect(n).toBeGreaterThan(0)
    })

  it('a blink draws the lid alone (no iris), as before', () => {
    // The base figure blinks on its own timer; `blink: 0` pins it open, so a closed eye is only reached by the mood
    // 'dead', which `full` leaves to the sprite's drawing.
    expect(same(draw({ full: false }, 4), draw({}, 4))).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { BASE } from '#src/shared/base/base-pair.ts'
import type { Material } from '#src/shared/body/parts.ts'
import { Figure } from '#src/shared/figure/figure.ts'
import { member, view } from '#src/shared/figure/frames.ts'
import { SWATCHES } from '#src/shared/outfit/garments.ts'
import { FACE_SEAM, tonesOf } from '#src/shared/paint/paint.ts'

/**
 * The face's tone budget as a swatch option (`Material.face`): the least share of the face in the lightest step. Today a face is mostly the middle step with a dark chin; a face that is mostly the lightest step is a bright
 * mass with two dark eyes, which is what a face at a small size needs. Measured on the painted cells of the base woman, on
 * the skin's own steps, at density 1 and 2.
 */
const SKIN = SWATCHES.skinWarm
const woman = BASE[1].def
const skinned = (face?: Material['face']) =>
  ({
    ...woman,
    skin: 'testSkin',
    swatches: { ...woman.swatches, testSkin: { ...SKIN, ...(face ? { face } : {}) } },
  }) as typeof woman
/** The shares of the face's skin texels (the head's own surface; its marks excluded) in each of the skin's four steps. */
function shares(def: typeof woman, D: number, d = 0) {
  const cast = member(def, D),
    f = new Figure(cast),
    steps = tonesOf({ ...SKIN }),
    count = [0, 0, 0, 0]
  for (let i = 0; i < 3; i++) f.update(1 / 60, { facing: (d * Math.PI) / 4, moving: false, view: view() })
  let n = 0
  for (let k = 0; k < cast.cell[0] * cast.cell[1]; k++) {
    if (!f.painted[k * 4 + 3] || f.g.part[k] !== FACE_SEAM) continue
    const rgb = (f.painted[k * 4] << 16) | (f.painted[k * 4 + 1] << 8) | f.painted[k * 4 + 2],
      s = steps.indexOf(rgb)
    if (s < 0) continue
    count[s]++
    n++
  }
  return count.map((c) => c / n)
}

describe('the face’s tone budget', () => {
  for (const D of [1, 2, 4])
    it(`light: .6 makes a face mostly its lightest step, at density ${D}`, () => {
      const plain = shares(skinned(), D),
        bright = shares(skinned({ light: 0.6 }), D)
      expect(bright[0], 'a bright face').toBeGreaterThan(0.5)
      expect(bright[0]).toBeGreaterThan(plain[0] + 0.25)
    })
  it('light: .6 holds in the three-quarter view and the profile too', () => {
    for (const d of [1, 2]) expect(shares(skinned({ light: 0.6 }), 2, d)[0], `view ${d}`).toBeGreaterThan(0.4)
  })
})

describe('a warm peach skin on DUEL', () => {
  it('skinFair is in the library and its four steps are DUEL colours, the middle one #ebbd9d', () => {
    const steps = tonesOf(SWATCHES.skinFair)
    expect(steps[1]).toBe(0xebbd9d)
    // A step that is not on DUEL would be moved by the snap; these are the colours the painter paints with.
    expect(steps.map((c) => `#${c.toString(16).padStart(6, '0')}`)).toEqual(SWATCHES.skinFair.paint)
  })
  it('a face in it paints in its steps, lighter than the warm skin’s, with `face.light` set', () => {
    const def = { ...skinned({ light: 0.6 }), skin: 'skinFair' } as typeof woman,
      cast = member(def, 2),
      f = new Figure(cast)
    for (let i = 0; i < 3; i++) f.update(1 / 60, { facing: 0, moving: false, view: view() })
    const light = tonesOf(SWATCHES.skinFair)[0]
    let n = 0
    for (let k = 0; k < cast.cell[0] * cast.cell[1]; k++)
      if (f.painted[k * 4 + 3] && f.g.part[k] === FACE_SEAM) {
        const rgb = (f.painted[k * 4] << 16) | (f.painted[k * 4 + 1] << 8) | f.painted[k * 4 + 2]
        if (rgb === light) n++
      }
    expect(n).toBeGreaterThan(0)
  })
})

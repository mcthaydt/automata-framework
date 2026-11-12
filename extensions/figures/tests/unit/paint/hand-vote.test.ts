import { describe, expect, it } from 'vitest'
import { BASE } from '#src/shared/base/base-pair.ts'
import { GROUP } from '#src/shared/body/parts.ts'
import { Figure } from '#src/shared/figure/figure.ts'
import { member, view } from '#src/shared/figure/frames.ts'
import { budget } from '#src/shared/paint/paint-budget.ts'
import type { HandFormKind } from '#src/shared/paint/paint-hand-form.ts'

/**
 * A hand's form moves nothing on the head. The colour budget merges the closest pair of a figure's colours and keeps
 * the commoner; what the hands cover or draw has no vote in which is the commoner (paint-hands.ts handReach), so a
 * larger hand over a held torch can no longer recolour the hair (the audit's item 6).
 */
describe('the colour budget: a texel with no vote never decides which of a pair stays', () => {
  // One material, 23 colours far apart and one close pair: 25 colours, one over the budget, so the pair merges. B is
  // the commoner, but only because of texels with no vote; A is the commoner where the vote is.
  const A = 0x406080,
    B = 0x416181,
    far = Array.from(
      { length: 23 },
      (_, i) => (((i * 97) % 256) << 16) | (((i * 53 + 128) % 256) << 8) | ((i * 31) % 256),
    )
  const draw = () => {
    const px: number[] = [...far.flatMap((c) => [c, c, c, c]), ...Array(10).fill(A), ...Array(30).fill(B)],
      w = px.length,
      out = new Uint8ClampedArray(w * 4)
    px.forEach((c, k) => {
      out.set([(c >> 16) & 255, (c >> 8) & 255, c & 255, 255], k * 4)
    })
    const vote = new Uint8Array(w).fill(1)
    // B's last 25 texels: the hands' reach.
    vote.fill(0, w - 25)
    return { out, w, vote }
  }
  const colourAt = (out: Uint8ClampedArray, k: number) =>
    (out[k * 4] << 16) | (out[k * 4 + 1] << 8) | out[k * 4 + 2]
  it('with every texel voting, the commoner (B) stays', () => {
    const { out, w } = draw()
    budget(out, w, 1, 1, new Uint8Array(w), () => 0)
    expect(colourAt(out, far.length * 4)).toBe(B)
  })
  it('with the hands left out, the colour the rest of the figure holds most (A) stays', () => {
    const { out, w, vote } = draw()
    budget(out, w, 1, 1, new Uint8Array(w), () => 0, vote)
    expect(colourAt(out, w - 1)).toBe(A)
  })
})

/** The base pair's frames with the hands in `form`: the review sheets' (8 standing and the walk) and holding
 * the library's torch from the front and the side; each with the row the arms start at (the shoulder line). */
function frames(def: (typeof BASE)[number]['def'], D: number, form: HandFormKind) {
  const out: { name: string; px: Uint8ClampedArray; w: number; shoulder: number }[] = []
  const take = (f: Figure, name: string) => {
    const [w] = f.cell
    let shoulder = Infinity
    for (let k = 0; k < f.g.group.length; k++)
      if (f.g.group[k] === GROUP.armL || f.g.group[k] === GROUP.armR) {
        shoulder = Math.floor(k / w)
        break
      }
    out.push({ name, px: f.painted.slice(), w, shoulder })
  }
  const figure = (torch: boolean) => {
    const f = new Figure({ ...member(def, D), blink: 0 })
    f.cache = false
    f.paintStyle.hand = form
    if (torch) f.wear(f.outfit, 'torch')
    return f
  }
  for (let d = 0; d < 8; d++) {
    const f = figure(false)
    for (let i = 0; i < 3; i++) f.update(1 / 60, { facing: (d * Math.PI) / 4, moving: false, view: view() })
    take(f, `turn ${d}`)
  }
  {
    const f = figure(false)
    for (let i = 0; i < 90; i++) {
      f.update(1 / 60, { facing: Math.PI / 4, moving: true, view: view() })
      if (i % 6 === 5) take(f, `walk ${i}`)
    }
  }
  for (const d of [0, 2]) {
    const f = figure(true)
    for (let i = 0; i < 3; i++) f.update(1 / 60, { facing: (d * Math.PI) / 4, moving: false, view: view() })
    take(f, `torch ${d}`)
  }
  return out
}

describe("a hand's form moves no texel above the shoulder line", () => {
  for (const c of BASE)
    for (const D of [1, 2])
      it(`${c.def.id} at density ${D}: the paddle and the parted hand paint the same head, hair and neck`, () => {
        const before = frames(c.def, D, 'paddle'),
          after = frames(c.def, D, 'parted')
        for (let i = 0; i < before.length; i++) {
          const a = before[i],
            b = after[i],
            rows = Math.min(a.shoulder, b.shoulder)
          let moved = 0
          for (let k = 0; k < a.w * rows * 4; k++) if (a.px[k] !== b.px[k]) moved++
          expect(moved, `${a.name}: bytes moved above the shoulders`).toBe(0)
        }
      }, 60_000)
})

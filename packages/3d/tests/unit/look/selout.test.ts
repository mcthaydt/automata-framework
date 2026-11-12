// The coloured outline (selective outlining, "selout"): a pixel beside a nearer shape takes that shape's own colour, a few
// steps down its ramp, a step lighter on the key's side. The rules are pure and the pass repeats them on the GPU.
import { DUEL_RAMPS } from '@automata/content/palette'
import { describe, expect, it } from 'vitest'
import { DEFAULT_LOOK } from '#src/features/look/look.ts'
import {
  beside,
  KEY_SIDE_STEP,
  OFF_KEY_STEP,
  onKeySide,
  outlineColour,
  stepBy,
} from '#src/features/look/outline-filter.ts'

const palette = DUEL_RAMPS.flat()

describe('stepBy', () => {
  it('moves a palette colour along its own ramp, never off it and never onto step 0', () => {
    const ramp = 5 // #282b4a .. #c6ecff
    const at = (s: number) => ramp * 8 + s
    expect(stepBy(at(6), -2)).toBe(at(4))
    expect(stepBy(at(3), -3)).toBe(at(1))
    expect(stepBy(at(1), -3)).toBe(at(1))
    expect(stepBy(at(6), 3)).toBe(at(7))
  })
})

describe('the outline rule', () => {
  it('says a pixel is beside a nearer shape when its depth is past the gap behind it', () => {
    expect(beside(5, 4.9, 0.06, 0)).toBe(true)
    expect(beside(5, 4.95, 0.06, 0)).toBe(false)
    // A perspective view lets the gap grow with distance, an orthographic one does not.
    expect(beside(10, 9.6, 0.06, 0.03)).toBe(true)
    expect(beside(10, 9.65, 0.06, 0.03)).toBe(false)
    // Nothing is outlined against what is behind it.
    expect(beside(4, 5, 0.06, 0)).toBe(false)
  })

  it('is on the key’s side when the near shape lies away from the key (the outline sits toward it)', () => {
    // The key comes from the upper left: a pixel to the upper left of the shape is on its key side.
    const key: readonly [number, number] = [-0.7071, -0.7071]
    expect(onKeySide([1, 1], key)).toBe(true)
    expect(onKeySide([-1, -1], key)).toBe(false)
    expect(onKeySide([1, -1], key)).toBe(false)
  })

  it('takes two steps down the near shape’s ramp on the key’s side and three off it', () => {
    expect(KEY_SIDE_STEP).toBe(-2)
    expect(OFF_KEY_STEP).toBe(-3)
    const owner = 5 * 8 + 6
    expect(outlineColour(owner, true)).toBe(palette[5 * 8 + 4])
    expect(outlineColour(owner, false)).toBe(palette[5 * 8 + 3])
  })

  it('is on by a switch, and its depth gap and perspective growth are the look’s', () => {
    expect(DEFAULT_LOOK.outline).toEqual({ gap: 0.06, perMetre: 0.03 })
  })
})

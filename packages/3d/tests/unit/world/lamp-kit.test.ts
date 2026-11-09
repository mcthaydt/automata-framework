import { describe, expect, it } from 'vitest'
import { LAMP_KINDS, lampColour, lampFault } from '#src/features/world/lamp-kit.ts'
import { hexToRgb, labDistance } from '#src/shared/math/colour.ts'

const TONE = 0.06

describe('a lamp’s colour', () => {
  it('is its kind’s when it names none', () => {
    for (const [name, kind] of Object.entries(LAMP_KINDS)) expect(lampColour(name)).toBe(kind.color)
  })

  it('stays within the tone of its kind’s, however far off the wanted colour is', () => {
    for (const [name, kind] of Object.entries(LAMP_KINDS)) {
      if (name === 'neon') continue
      for (const wanted of ['#0000ff', '#00ff00', '#ffffff', '#000000', '#ff0000']) {
        const made = lampColour(name, wanted)
        expect(labDistance(hexToRgb(made), hexToRgb(kind.color)), `${name} ${wanted}`).toBeLessThanOrEqual(
          TONE,
        )
        expect(lampFault({ kind: name, color: made }), `${name} ${wanted}`).toBeUndefined()
      }
    }
  })

  it('is left alone when it is already within tone, and when the kind is a neon', () => {
    expect(lampColour('pendant', '#ffd79e')).toBe('#ffd79e')
    expect(lampColour('neon', '#00ff00')).toBe('#00ff00')
  })
})

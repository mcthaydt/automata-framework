import { FlatMaterial } from '@pixi/3d'
import { describe, expect, it } from 'vitest'
import { channels } from '#src/shared/render/light/vertex-light.ts'
import { tinted } from '#src/shared/render/views/box-view.ts'
import { beta2Colour, UnlitMaterial } from '#src/shared/render/views/unlit-material.ts'

describe('UnlitMaterial', () => {
  it('is a FlatMaterial that takes the framework’s own fog, so a game can swap it in', () => {
    const material = new UnlitMaterial({ baseColor: 0xa0c0e0 })
    expect(material).toBeInstanceOf(FlatMaterial)
    // The engine's fog is off for it (the display-space fog bit does the mixing) and it works in linear light.
    expect(material.fog).toBe(false)
    expect(material.colorSpace).toBe('linear')
    expect(material.lit).toBe(false)
  })
})

describe('beta2Colour', () => {
  it('is the colour `@pixi/3d` 0.1.0-beta.2’s unlit material showed for a colour: its linear value (a 128 grey drew as 55)', () => {
    expect(beta2Colour(0x808080)).toBe(0x373737)
    // The embers of base-3d: 0xe37840 drew as a darker, redder orange than the hex says.
    expect(beta2Colour(0xe37840)).toBe(0xc4300d)
    expect(beta2Colour(0xffffff)).toBe(0xffffff)
    expect(beta2Colour(0x000000)).toBe(0x000000)
  })
})

describe('tinted', () => {
  it('is the lit light as the display value, as beta.2 showed a lit moving thing', () => {
    // 0x80 is 0.2158 linear; half of it is 0.108, which beta.2's unlit material drew as it stood: 28 (0x1c).
    expect(tinted(channels(0x808080), [0.5, 0.5, 0.5])).toBe(0x1c1c1c)
    expect(tinted(channels(0xffffff), [2, 2, 2])).toBe(0xffffff)
  })
})

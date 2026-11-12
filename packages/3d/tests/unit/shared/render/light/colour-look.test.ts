// The colour look: a switch for the two ways an unlit colour can reach the screen on `@pixi/3d` 0.1.0-beta.3, until the Owner has
// chosen. 'authored' is what the beta does (an unlit colour shows as written, fog reaches the fog colour); 'beta2' keeps the picture
// beta.2 drew (an unlit base colour drew as its linear value, so a fog colour reached the screen darker: 0x8b9bb4 as 0x425474).
import { afterEach, describe, expect, it } from 'vitest'
import { colourLook, setColourLook } from '#src/shared/render/light/colour-look.ts'
import { channels } from '#src/shared/render/light/vertex-light.ts'
import { fogSkyColor, viewFog } from '#src/shared/render/light/view-fog.ts'
import { tinted } from '#src/shared/render/views/box-view.ts'

afterEach(() => setColourLook('authored'))

const FOG = { near: 4, far: 12, color: 0x8b9bb4 }

describe('the colour look', () => {
  it('is the beta’s own, authored, until a game says otherwise', () => {
    expect(colourLook()).toBe('authored')
  })

  it('authored: the fully fogged colour on screen is the fog colour, and the sky is that colour', () => {
    expect(viewFog(FOG, undefined)?.color).toBe(0x8b9bb4)
    expect(fogSkyColor(FOG)).toBe(0x8b9bb4)
  })

  it('beta2: fog reaches the screen at beta.2’s darker value, and the sky meets it', () => {
    setColourLook('beta2')
    expect(viewFog(FOG, undefined)?.color).toBe(0x425474)
    expect(fogSkyColor(FOG)).toBe(0x425474)
  })

  it('authored: a lit moving colour is the base colour’s linear light times the tint, encoded for the display', () => {
    const linear = channels(0x808080)
    // lin(0x80) = 0.2159 × 0.5 = 0.108, encoded (the sRGB curve): 0.3625 → 92 (0x5c).
    expect(tinted(linear, [0.5, 0.5, 0.5])).toBe(0x5c5c5c)
  })

  it('beta2: the same product as beta.2 drew it, the linear light itself as the display value', () => {
    setColourLook('beta2')
    // 0.108 → 28 (0x1c).
    expect(tinted(channels(0x808080), [0.5, 0.5, 0.5])).toBe(0x1c1c1c)
  })
})

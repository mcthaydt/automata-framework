import { describe, expect, it } from 'vitest'
import { engineFogColour, fogSkyColor, viewFog } from '#src/shared/render/light/view-fog.ts'

describe('viewFog', () => {
  it('is linear fog from the options, else from the lighting content, else none', () => {
    const content = { near: 4, far: 12, color: 0x2e222f }
    const options = { near: 6, far: 20, color: 0x3e3546 }
    expect(viewFog(options, content)).toEqual({
      type: 'linear',
      near: 6,
      far: 20,
      color: engineFogColour(0x3e3546),
    })
    expect(viewFog(undefined, content)).toEqual({
      type: 'linear',
      near: 4,
      far: 12,
      color: engineFogColour(0x2e222f),
    })
    expect(viewFog(undefined, undefined)).toBeNull()
  })

  it('hands the engine the colour whose 2.2 decode is the linear light beta.2 mixed toward', () => {
    // `@pixi/3d` 0.1.0-beta.3 decodes a fog colour with a 2.2 gamma where beta.2 used the piecewise sRGB curve. For 0x31222a beta.2's
    // linear light is (0.0309, 0.0160, 0.0232); as an 8-bit colour that is (52, 39, 46), not the (49, 34, 42) the game wrote.
    const [r, g, b] = engineFogColour(0x31222a)
    expect([r, g, b].map((c) => Math.round(255 * c))).toEqual([52, 39, 46])
    // Decoded by 2.2, it is beta.2's linear light, to the digit: light, as the piecewise curve gives it.
    const piecewise = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
    expect(r ** 2.2).toBeCloseTo(piecewise(0x31 / 255), 9)
    expect(g ** 2.2).toBeCloseTo(piecewise(0x22 / 255), 9)
    expect(b ** 2.2).toBeCloseTo(piecewise(0x2a / 255), 9)
  })

  it('draws the sky at the colour beta.2 showed fully fogged unlit pixels in (0x8b9bb4 as 0x425474)', () => {
    expect(fogSkyColor({ near: 4, far: 12, color: 0x8b9bb4 })).toBe(0x425474)
  })

  it('refuses options fog that the content schema would refuse (far not past near, a bad colour)', () => {
    expect(() => viewFog({ near: 5, far: 5, color: 0 }, undefined)).toThrow(/fog/)
    expect(() => viewFog({ near: -1, far: 5, color: 0 }, undefined)).toThrow(/fog/)
    expect(() => viewFog({ near: 1, far: 5, color: 0x1000000 }, undefined)).toThrow(/fog/)
  })
})

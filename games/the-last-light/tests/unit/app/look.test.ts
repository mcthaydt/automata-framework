import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BAR_COLOR, hazeColourOf, lookOf } from '#src/app/look.ts'

// The picture's look is the old game's. Its fog was the view's own linear fog in `@pixi/3d` 0.1.0-beta.2, which draws a fog
// colour as its linear value read as if it were sRGB, so the old haze colour 0x4b5a56 reached the screen as a dark grey-green,
// not the mid teal the framework's look veils the far end of a room with. The framework's haze is a post pass that draws its
// colour as given, so the game gives the colour the old fog reached the screen as.

describe('the haze colour the old fog reached the screen as', () => {
  it('is the fog colour’s linear value read as sRGB', () => {
    // 0x4b, 0x5a, 0x56 are 75, 90, 86 of 255: linear 0.0704, 0.1022, 0.0931, which is 18, 26, 24 of 255.
    expect(hazeColourOf(0x4b5a56)).toBe('#121a18')
    expect(hazeColourOf(0xffffff)).toBe('#ffffff')
    expect(hazeColourOf(0x000000)).toBe('#000000')
  })
})

describe('the game’s look', () => {
  const look = lookOf({ width: 640, height: 480 }, 16.6)

  it('draws at the picture’s own short side', () => {
    expect(look.pixel.short).toBe(480)
    expect(lookOf({ width: 640, height: 360 }, 16.6).pixel.short).toBe(360)
  })

  // The old game's palette snap (`retro-filter.ts`, `look.ts` `dither` at 92e6704) adds an 8 by 8 Bayer offset of at most 1/64 of the colour
  // range, scaled down as the pixel gets lighter and cut to nothing in the deep blacks "to eliminate crawling noise". The framework's snap
  // is a 4 by 4 offset of `strength`, the same at every luma: its default 0.04 is 2.5 times the old game's, which is the black and dark-teal
  // speckle in ours where the old game's shadows are smooth.
  it('dithers as lightly as the old game’s snap: 1/64 of the colour range', () => {
    expect(look.dither.strength).toBeCloseTo(1 / 64, 6)
  })

  // The old snap scaled the offset by (1 - 0.5 luma) and cut it to nothing in the deep blacks (`lumaWeight` 0.5 and the `smoothstep(0.02, 0.08)` taper).
  it('weights the dither by luma and tapers it in the deep blacks, as the old game’s snap does', () => {
    expect(look.dither.lumaWeight).toBe(0.5)
    expect(look.dither.shadowTaper).toBe(true)
  })

  it('veils the far end of a room in the old haze: its dark colour, whole from 7 m past the focus, no light added', () => {
    expect(look.haze).toMatchObject({ colour: '#121a18', near: 0, far: 7, amount: 1, glow: 0 })
  })

  it('takes the haze\u2019s focus from the play camera\u2019s distance, not the first-person 3 m that would veil the whole room', () => {
    expect(look.haze.focusFp).toBe(16.6)
    expect(lookOf({ width: 640, height: 480 }, 15).haze.focusFp).toBe(15)
  })
})

describe('the bars round the picture', () => {
  // The old game's page and its bars are black (`--c-void: #000000` in `src/style.css` at 92e6704). The framework's own bar is DUEL's
  // darkest plum, so the game names its bar colour and hands it to the renderer; the picture's own colours are left as they are.
  it('are black, one named colour', () => {
    expect(BAR_COLOR).toBe(0x000000)
  })

  it('stand on a black page', () => {
    const css = readFileSync(new URL('../../../style.css', import.meta.url), 'utf8')
    expect(css).toMatch(/--void:\s*#000000/)
    expect(css).toMatch(/:root body\s*\{[^}]*background-color:\s*var\(--void\)/s)
  })
})

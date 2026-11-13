import { content } from 'virtual:automata/content'
import { describe, expect, it } from 'vitest'
import { playOf } from '#src/app/content.ts'
import { fieldFor } from '#src/app/field.ts'
import { figureDensity, playDensity, zoomAtFeet } from '#src/app/figure-density.ts'

// The figures are painted at the density the play camera needs on the game's field, by the painter's rule (`densityNeeded`), at most the
// cast's density 2, and held for the run: the field is fixed when the game starts, and a density that followed each frame's zoom would
// flip her paint as she walks nearer and farther under the pulled-back camera.

const PLAY = playOf(content)

describe('the figures’ density in play', () => {
  it('is 2 on the 384-line field of a 1024 by 768 window and the 360 lines of a 1920 by 1080 one', () => {
    expect(fieldFor({ width: 1024, height: 768 }).height).toBe(384)
    expect(playDensity(PLAY.views, 384)).toBe(2)
    expect(fieldFor({ width: 1920, height: 1080 }).height).toBe(360)
    expect(playDensity(PLAY.views, 360)).toBe(2)
  })

  it('is 1 on a phone held sideways (844 by 390, a 195-line field), where density 2 could not stand back at all', () => {
    expect(fieldFor({ width: 844, height: 390 }).height).toBe(195)
    expect(playDensity(PLAY.views, 195)).toBe(1)
  })

  it('draws a texel one field pixel at both sizes, so she is about a third of the picture’s height in each', () => {
    for (const lines of [384, 195]) {
      const density = playDensity(PLAY.views, lines)
      for (const view of PLAY.views)
        expect(Math.max(1, Math.round(zoomAtFeet(view, lines) / density)), view.id).toBe(1)
    }
  })

  it('is the cast’s density 2 while a cutscene draws its own shot, so a close-up on a phone keeps the face its lens was set for', () => {
    let drawing = false
    const density = figureDensity(() => drawing, 1)
    expect(density()).toBe(1)
    drawing = true
    expect(density()).toBe(2)
    drawing = false
    expect(density()).toBe(1)
  })
})

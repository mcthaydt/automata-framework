// The retro grade fades, tints and grains the picture the look has made, in display colours that the snap then puts back on
// the palette: it runs after tone mapping (`@pixi/3d` 0.1.0-beta.3 runs a post effect before it unless it says otherwise).
import { describe, expect, it } from 'vitest'
import { RetroEffect } from '#src/features/retro/retro-effect.ts'

describe('the retro pass', () => {
  it('runs after tone mapping', () => {
    expect(new RetroEffect().stage).toBe('afterToneMapping')
  })

  it('keeps its stage when told it is off', () => {
    const effect = new RetroEffect({}, { enabled: false })
    expect(effect.enabled).toBe(false)
    expect(effect.stage).toBe('afterToneMapping')
  })
})

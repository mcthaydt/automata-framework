// The LCD panel simulates the screen the picture is shown on, so it works on the picture as it shows: after tone mapping
// (`@pixi/3d` 0.1.0-beta.3 runs a post effect before it unless it says otherwise).
import { describe, expect, it } from 'vitest'
import { LcdPanelEffect } from '#src/features/lcd-panel/lcd-effect.ts'

describe('the LCD panel pass', () => {
  it('runs after tone mapping', () => {
    expect(new LcdPanelEffect().stage).toBe('afterToneMapping')
  })

  it('keeps its stage when told it is off', () => {
    const effect = new LcdPanelEffect({}, { enabled: false })
    expect(effect.enabled).toBe(false)
    expect(effect.stage).toBe('afterToneMapping')
  })
})

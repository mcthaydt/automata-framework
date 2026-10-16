import { describe, expect, it } from 'vitest'
import * as RenderPixi from './index.js'

describe('@mcthaydt/automata-render-pixi', () => {
  it('exports expected symbols', () => {
    expect(RenderPixi).toBeDefined()
  })

  it('exports the rect and sprite entity views and their pose helpers', () => {
    expect(typeof RenderPixi.rect).toBe('function')
    expect(typeof RenderPixi.sprite).toBe('function')
    expect(typeof RenderPixi.lerp).toBe('function')
    expect(typeof RenderPixi.lerpAngle).toBe('function')
    expect(typeof RenderPixi.interpolatePose).toBe('function')
  })
})

import { describe, expect, it } from 'vitest'
import * as RenderPixi from '#src/index.ts'

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

  it('exports camera2d and its shake constants (M4.8)', () => {
    expect(typeof RenderPixi.createCamera2d).toBe('function')
    expect(RenderPixi.SHAKE_DECAY).toBe(1.5)
    expect(RenderPixi.SHAKE_MAX_OFFSET).toBe(8)
  })

  // DX.2a: published, the package's version is package.json's, which Changesets bumps; a constant in source
  // (once `VERSION = '0.0.1'`, read by nothing) would state a wrong one from the first release.
  it('states no version of its own', () => {
    expect('VERSION' in RenderPixi).toBe(false)
  })
})

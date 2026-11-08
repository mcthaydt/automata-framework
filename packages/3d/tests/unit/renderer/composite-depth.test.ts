import type { PixiStage } from '@automata/framework'
import { describe, expect, it, vi } from 'vitest'
import { compositeDepthHooks } from '#src/features/renderer/composite-depth.ts'

/** A stage whose composite texture has a render target with a depth texture, and a GL texture system to watch. */
function fakeStage(options: { webgl?: boolean; composite?: boolean } = {}) {
  const depth = { source: 'depth' }
  const target = { ensureDepthStencilTexture: vi.fn(), depthStencilTexture: depth }
  const texture = { getGlSource: vi.fn(), unbind: vi.fn() }
  const renderer = {
    ...(options.webgl === false ? {} : { gl: {} }),
    texture,
    renderTarget: { getRenderTarget: vi.fn(() => target) },
  }
  const stage = {
    app: { renderer },
    composite: options.composite === false ? undefined : { texture: { name: 'composite' } },
  } as unknown as PixiStage
  return { stage, depth, target, texture, renderer }
}

describe('compositeDepthHooks', () => {
  it('makes the composite depth texture and leaves it bound to no sampler unit, every frame', () => {
    const { stage, depth, target, texture } = fakeStage()
    const hooks = compositeDepthHooks(stage)
    hooks.draw?.({ alpha: 0 } as never)
    hooks.draw?.({ alpha: 0 } as never)
    // Created before the 3D view's first pass so the first 2D draw over the view is clean too, then dropped from the
    // unit its creation bound it to (a texture attached to the target and sampled by a draw is a feedback loop).
    expect(target.ensureDepthStencilTexture).toHaveBeenCalled()
    expect(texture.getGlSource).toHaveBeenCalledWith(depth.source)
    expect(texture.unbind).toHaveBeenCalledTimes(2)
    expect(texture.unbind).toHaveBeenCalledWith(depth.source)
  })

  it('does nothing without a composite target', () => {
    const { stage, texture } = fakeStage({ composite: false })
    compositeDepthHooks(stage).draw?.({ alpha: 0 } as never)
    expect(texture.unbind).not.toHaveBeenCalled()
  })

  it('does nothing on WebGPU', () => {
    const { stage, texture } = fakeStage({ webgl: false })
    compositeDepthHooks(stage).draw?.({ alpha: 0 } as never)
    expect(texture.unbind).not.toHaveBeenCalled()
  })
})

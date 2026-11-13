// The texel-lattice check (tests/browser/painted/painted-grid.test.ts) under Pixi's WebGPU renderer, the screen mesh's WGSL included.
// A browser with no adapter, or one that does not present a frame, skips, in words (run it with AF_WEBGPU=software where there is no GPU).
import { afterEach, describe, expect, it } from 'vitest'
import { closeGridScene, frameOf, open, splitBlocks } from '../../fixtures/grid-scene.ts'

afterEach(closeGridScene)

describe('a painted figure on its texel lattice under a screen mesh, in WebGPU', () => {
  it('keeps every texel whole between the lines', async (context) => {
    const px = await frameOf(0.0137, true, 'webgpu')
    if (open?.stage.app.renderer.name !== 'webgpu')
      return context.skip('This browser grants no WebGPU adapter, so the renderer fell back to WebGL.')
    const { split, figure } = splitBlocks(px)
    if (figure === 0 || px[3] === 0)
      return context.skip(
        'This WebGPU adapter does not present a frame here; run it where it does (AF_WEBGPU=software).',
      )
    expect(figure, 'texels of the figure seen').toBeGreaterThan(300)
    expect(split).toEqual([])
  })
})

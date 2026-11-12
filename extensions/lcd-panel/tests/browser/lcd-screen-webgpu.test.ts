// The panel's screen filter on a real WebGPU renderer, in its own page (screen-support.ts says why). WebGPU needs an adapter that
// presents (`AF_WEBGPU=software` on a machine with no GPU); without one it skips, in words.
import { describe, it } from 'vitest'
import { CANVAS, expectLinesOnTexelBorders, ORIGIN, shot, start } from './screen-support.ts'

describe('the panel as a screen filter', () => {
  it('puts them on the same borders under WebGPU', async (context) => {
    const renderer = await start('webgpu')
    if (renderer.stage.app.renderer.name !== 'webgpu')
      return context.skip('This browser grants no WebGPU adapter, so the renderer fell back to WebGL.')
    for (let i = 0; i < 4; i++) {
      shot(renderer)
      await new Promise((resolve) => requestAnimationFrame(resolve))
    }
    const px = shot(renderer)
    const centre = ((ORIGIN.y + 1) * CANVAS.width + ORIGIN.x + 1) * 4
    if (px[centre] === 0 && px[centre + 3] === 0)
      return context.skip(
        'This WebGPU adapter does not present a frame here; run it where it does (AF_WEBGPU=software).',
      )
    expectLinesOnTexelBorders(px)
  })
})

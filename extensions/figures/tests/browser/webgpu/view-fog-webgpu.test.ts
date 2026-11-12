/**
 * The fog cases again through Pixi's WebGPU renderer (see ../view/view-fog.test.ts). Skips, in words, in a browser whose WebGPU
 * grants no adapter or presents no frame, as view-webgpu.test.ts does.
 */
import { beforeAll, describe, it } from 'vitest'
import { type WebgpuState, webgpuState } from '../../fixtures/view-draw.ts'
import { expectSpriteFogged, expectStageFogged } from '../../fixtures/view-fog.ts'

const WHY: Record<WebgpuState, string> = {
  'no adapter':
    'This browser grants no WebGPU adapter, so the renderer fell back to WebGL: run it with AF_WEBGPU=software or on a GPU.',
  'no frame':
    'This browser grants a WebGPU adapter that does not present a frame (a plain square reads back transparent), so there is nothing to compare: run it where WebGPU presents (AF_WEBGPU=software).',
  presents: '',
}
let state: WebgpuState = 'presents'
beforeAll(async () => {
  state = await webgpuState()
})

describe('a painted figure in fog, under WebGPU', () => {
  it('a stage quad is mixed toward the fog in display values', async (ctx) => {
    if (state !== 'presents') ctx.skip(WHY[state])
    await expectStageFogged('webgpu')
  })
  it('a figure sprite is mixed toward the fog in display values', async (ctx) => {
    if (state !== 'presents') ctx.skip(WHY[state])
    await expectSpriteFogged('webgpu')
  })
})

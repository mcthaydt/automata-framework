/**
 * The stage cases again through Pixi's WebGPU renderer, in a Chromium launched with WebGPU on (vitest.config.ts): what the
 * GPU draws is `compose` of what the stage placed, as under WebGL. A browser whose WebGPU grants no adapter, or grants one
 * that draws no frame, skips, in words; a browser whose WebGPU presents must draw every case and match.
 */
import { beforeAll, describe, it } from 'vitest'
import { CASES } from '../../fixtures/view-cases.ts'
import { expectCase } from '../../fixtures/view-claims.ts'
import { type WebgpuState, webgpuState } from '../../fixtures/view-draw.ts'

const WHY: Record<WebgpuState, string> = {
  'no adapter':
    'This browser grants no WebGPU adapter, so the renderer fell back to WebGL: run it with AF_WEBGPU=software or on a GPU.',
  'no frame':
    'This browser grants a WebGPU adapter that does not present a frame (a plain square reads back transparent), so there is nothing to compare: run it where WebGPU presents (AF_WEBGPU=software).',
  presents: '',
}
/** Set by `beforeAll`, once, before any case. */
let state: WebgpuState = 'presents'
beforeAll(async () => {
  state = await webgpuState()
})

describe('the stage cases, under WebGPU', () => {
  for (const name of Object.keys(CASES))
    it(`${name}: ${CASES[name].claim === 'bytes' ? 'every byte is compose(frame)' : 'the palette holds'}`, async (ctx) => {
      if (state !== 'presents') ctx.skip(WHY[state])
      await expectCase(name, 'webgpu')
    })
})

// Which way up the sky is, on WebGPU: the WGSL twin of `tests/browser/parity/look/sky-orientation.test.ts`, the same scene
// (`src/testing/sky-frame.ts`). A WebGPU canvas keeps no drawing buffer past the task that drew it, so it is copied to a 2D canvas in that task.
import '#src/entries/no-eval.ts'
import { describe, expect, it, type TestContext } from 'vitest'
import { shootSky, skyMisses } from '#src/testing/sky-frame.ts'
import { notOnWebGpu } from '#src/testing/webgpu-skip.ts'

const hasWebGpu =
  typeof navigator !== 'undefined' && 'gpu' in navigator
    ? (await (navigator as Navigator & { gpu: GPU }).gpu.requestAdapter().catch(() => null)) !== null
    : false

/** The canvas as it was presented, copied in the task that drew it. */
function presented(renderer: { stage: { app: { canvas: unknown } } }): Uint8ClampedArray {
  const canvas = renderer.stage.app.canvas as HTMLCanvasElement
  const copy = document.createElement('canvas')
  copy.width = canvas.width
  copy.height = canvas.height
  const context = copy.getContext('2d') as CanvasRenderingContext2D
  context.drawImage(canvas, 0, 0)
  return context.getImageData(0, 0, copy.width, copy.height).data
}

describe.runIf(hasWebGpu)('the sky on WebGPU: which way up', () => {
  it('draws the haze below the horizon and the time’s bands above it, with the camera level', async ({
    skip,
  }: TestContext) => {
    const frame = await shootSky('webgpu', presented, (renderer) => {
      const fellBack = notOnWebGpu(renderer.stage.app.renderer)
      if (fellBack !== undefined) skip(fellBack)
    })
    expect(skyMisses(frame)).toEqual([])
  }, 60_000)
})

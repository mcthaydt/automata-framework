// What a fog does to each kind of surface on WebGPU: the colours beta.2 drew (`src/testing/fog-surfaces.ts`, recorded on WebGL2), so the
// unlit fog bit's WGSL twin and the engine's own WGSL fog show what the GLSL ones show. A WebGPU canvas keeps no drawing buffer past the
// task that drew it, so it is copied to a 2D canvas in that task. A machine with no adapter skips, with the reason.
import '#src/entries/no-eval.ts'
import { describe, expect, it, type TestContext } from 'vitest'
import { EXPECTED, KINDS, rowMisses, shootFog } from '#src/testing/fog-surfaces.ts'
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

describe.runIf(hasWebGpu)('fog on WebGPU, every surface kind, against beta.2', () => {
  for (const kind of KINDS)
    for (const name of ['light', 'dark'] as const)
      it(`${kind}, ${name} fog: the colour at 6, 8, 10 and 14 m is beta.2's`, async ({
        skip,
      }: TestContext) => {
        const seen = await shootFog(kind, name, 'webgpu', presented, (renderer) => {
          const fellBack = notOnWebGpu(renderer.stage.app.renderer)
          if (fellBack !== undefined) skip(fellBack)
        })
        expect(rowMisses(`${kind} ${name}`, seen, EXPECTED[`${kind} ${name}`])).toEqual([])
      }, 60_000)
})

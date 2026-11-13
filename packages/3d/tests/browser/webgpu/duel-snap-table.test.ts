// The snap with the candidate table against the snap with the full 256-colour loop, through Pixi's WebGPU renderer (the same
// gradient and the same byte-for-byte comparison as `parity/look/duel-snap-table.test.ts`). A machine with no WebGPU adapter
// skips with the reason, as the other WebGPU tests do.
import '#src/entries/no-eval.ts'
import { CubeGeometry, FlatMaterial, Mesh3D } from '@pixi/3d'
import { afterEach, describe, expect, it, type TestContext } from 'vitest'
import { createPixi3dRenderer, type Pixi3dRenderer } from '#src/app/create-renderer.ts'
import { DEFAULT_LOOK } from '#src/features/look/look.ts'
import { builtRenderer } from '#src/testing/built-renderer.ts'
import { BACKGROUND, snapStats } from '#src/testing/duel-snap-compare.ts'
import { testTarget } from '#src/testing/test-target.ts'
import { notOnWebGpu } from '#src/testing/webgpu-skip.ts'

const SIZE = 512

let scope: { dispose(): void } | undefined
afterEach(() => {
  scope?.dispose()
  scope = undefined
  document.body.replaceChildren()
})

async function start(skip: TestContext['skip']): Promise<Pixi3dRenderer> {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const renderer = await builtRenderer(
    createPixi3dRenderer({
      preference: 'webgpu',
      logicalWidth: SIZE,
      logicalHeight: SIZE,
      backgroundColor: BACKGROUND,
      views: {},
      look: DEFAULT_LOOK,
      scene: (view) => {
        view.camera.position.set(0, 0, 5)
        view.camera.lookAt({ x: 0, y: 0, z: 0 })
        view.root.addChild(
          new Mesh3D({ geometry: new CubeGeometry(), material: new FlatMaterial({ baseColor: 0x96b2d9 }) }),
        )
        return undefined
      },
    })(testTarget(host, {}, { width: SIZE, height: SIZE })),
  )
  scope = renderer
  const fellBack = notOnWebGpu(renderer.stage.app.renderer)
  if (fellBack !== undefined) skip(fellBack)
  return renderer
}

/** The canvas as it was presented, copied in the task that drew it (a WebGPU canvas keeps no drawing buffer past it). */
function presented(renderer: Pixi3dRenderer): Uint8ClampedArray {
  const canvas = renderer.stage.app.canvas as HTMLCanvasElement
  const copy = document.createElement('canvas')
  copy.width = canvas.width
  copy.height = canvas.height
  const context = copy.getContext('2d') as CanvasRenderingContext2D
  context.drawImage(canvas, 0, 0)
  return context.getImageData(0, 0, copy.width, copy.height).data
}

describe('the snap with the candidate table, on WebGPU', () => {
  for (const strength of [0.04, 0]) {
    it(`draws the same bytes as the 256-colour loop for a dense sample of the colour cube, at dither ${strength}`, async ({
      skip,
    }) => {
      const renderer = await start(skip)
      const stats = snapStats(renderer, strength, 16, SIZE, presented)
      expect(stats.pixels + stats.background).toBe(16 * SIZE * SIZE)
      expect(stats.colours).toBeGreaterThan(3_000_000)
      expect(stats.cells).toBe(16)
      expect(stats.differ).toBe(0)
      expect(stats.notPalette).toBe(0)
    }, 600_000)
  }

  it('draws the same bytes as the loop after the dither strength is changed on a live effect', async ({
    skip,
  }) => {
    const renderer = await start(skip)
    const stats = snapStats(renderer, 0.2, 4, SIZE, presented, 0.04)
    expect(stats.pixels).toBeGreaterThan(900_000)
    expect(stats.differ).toBe(0)
    expect(stats.notPalette).toBe(0)
  }, 600_000)
})

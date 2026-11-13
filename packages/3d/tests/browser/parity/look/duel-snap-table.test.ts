// The snap with the candidate table against the snap with the full 256-colour loop, on a real WebGL2 context: a gradient
// that covers a dense sample of the 8-bit colour cube in every Bayer cell goes through both, and the two pictures must be
// the same bytes. The gradient's own colours are read back too, so the test knows exactly what the snap was given.
import '#src/entries/no-eval.ts'
import { CubeGeometry, FlatMaterial, Mesh3D } from '@pixi/3d'
import { afterEach, describe, expect, it } from 'vitest'
import { createPixi3dRenderer, type Pixi3dRenderer } from '#src/app/create-renderer.ts'
import { DEFAULT_LOOK } from '#src/features/look/look.ts'
import { builtRenderer } from '#src/testing/built-renderer.ts'
import { BACKGROUND, snapStats } from '#src/testing/duel-snap-compare.ts'
import { snapshot } from '#src/testing/snapshot.ts'
import { testTarget } from '#src/testing/test-target.ts'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null
const SIZE = 512

let scope: { dispose(): void } | undefined
afterEach(() => {
  scope?.dispose()
  scope = undefined
  document.body.replaceChildren()
})

async function start(): Promise<Pixi3dRenderer> {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const renderer = await builtRenderer(
    createPixi3dRenderer({
      logicalWidth: SIZE,
      logicalHeight: SIZE,
      backgroundColor: BACKGROUND,
      views: {},
      look: DEFAULT_LOOK,
      scene: (view) => {
        view.camera.position.set(0, 0, 5)
        view.camera.lookAt({ x: 0, y: 0, z: 0 })
        // The view draws its passes only when it has something to draw; the gradient covers whatever the cube is.
        view.root.addChild(
          new Mesh3D({ geometry: new CubeGeometry(), material: new FlatMaterial({ baseColor: 0x96b2d9 }) }),
        )
        return undefined
      },
    })(testTarget(host, {}, { width: SIZE, height: SIZE })),
  )
  scope = renderer
  return renderer
}

describe.runIf(hasWebGL2)('the snap with the candidate table, on WebGL2', () => {
  for (const strength of [0.04, 0, 0.13]) {
    it(`draws the same bytes as the 256-colour loop for a dense sample of the colour cube, at dither ${strength}`, async () => {
      const renderer = await start()
      const stats = snapStats(renderer, strength, 16, SIZE, snapshot)
      expect(stats.pixels + stats.background).toBe(16 * SIZE * SIZE)
      expect(stats.colours).toBeGreaterThan(3_000_000)
      expect(stats.cells).toBe(16)
      expect(stats.differ).toBe(0)
      expect(stats.notPalette).toBe(0)
    }, 600_000)
  }

  // A look can change its dither after the pass was made: the table is rebuilt for the new strength.
  it('draws the same bytes as the loop after the dither strength is changed on a live effect', async () => {
    const renderer = await start()
    const stats = snapStats(renderer, 0.2, 4, SIZE, snapshot, 0.04)
    expect(stats.pixels).toBeGreaterThan(900_000)
    expect(stats.differ).toBe(0)
    expect(stats.notPalette).toBe(0)
  }, 600_000)
})

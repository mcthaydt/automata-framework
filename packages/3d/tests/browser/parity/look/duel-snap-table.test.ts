// The snap with the candidate table against the snap with the full 256-colour loop, on a real WebGL2 context: a gradient
// that covers a dense sample of the 8-bit colour cube in every Bayer cell goes through both, and the two pictures must be
// the same bytes. The gradient's own colours are read back too, so the test knows exactly what the snap was given.
import '#src/entries/no-eval.ts'
import { DEFAULT_PALETTE } from '@automata/content/palette'
import { CubeGeometry, FlatMaterial, Mesh3D } from '@pixi/3d'
import { afterEach, describe, expect, it } from 'vitest'
import { createPixi3dRenderer, type Pixi3dRenderer } from '#src/app/create-renderer.ts'
import { referenceSnap } from '#src/features/look/duel-snap-table.ts'
import { DEFAULT_LOOK } from '#src/features/look/look.ts'
import { builtRenderer } from '#src/testing/built-renderer.ts'
import { compareSnaps, inputAt } from '#src/testing/duel-snap-compare.ts'
import { snapshot } from '#src/testing/snapshot.ts'
import { testTarget } from '#src/testing/test-target.ts'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null
const SIZE = 512
const BACKGROUND = 0x2e222f
const PALETTE = DEFAULT_PALETTE.colors.map((hex) => Number.parseInt(hex.slice(1), 16))

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
      backgroundColor: 0x2e222f,
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
      const stats = {
        pixels: 0,
        background: 0,
        differ: 0,
        notPalette: 0,
        offModel: 0,
        wrongInput: 0,
        colours: new Set<number>(),
        cells: new Set<number>(),
      }
      compareSnaps(renderer, strength, 16, snapshot, (f) => {
        for (let i = 0; i < f.input.length; i += 4) {
          const rgb = [f.input[i] ?? 0, f.input[i + 1] ?? 0, f.input[i + 2] ?? 0] as const
          // Rows the view does not cover keep the stage's background, which no pass draws.
          if (((rgb[0] << 16) | (rgb[1] << 8) | rgb[2]) === BACKGROUND) {
            stats.background++
            continue
          }
          stats.pixels++
          stats.colours.add((rgb[0] << 16) | (rgb[1] << 8) | rgb[2])
          const same =
            f.table[i] === f.loop[i] && f.table[i + 1] === f.loop[i + 1] && f.table[i + 2] === f.loop[i + 2]
          if (!same) stats.differ++
          const got = ((f.table[i] ?? 0) << 16) | ((f.table[i + 1] ?? 0) << 8) | (f.table[i + 2] ?? 0)
          if (!PALETTE.includes(got)) stats.notPalette++
          // The gradient's colour says which pixel drew it and so which Bayer cell it met.
          const { cell } = inputAt(rgb, f.frame, SIZE)
          stats.cells.add(cell)
          const want = referenceSnap([rgb[0] / 255, rgb[1] / 255, rgb[2] / 255], cell, strength)
          if (PALETTE[want] !== got) stats.offModel++
        }
      })
      console.log(
        `SNAPSTATS ${strength} ${JSON.stringify({ ...stats, colours: stats.colours.size, cells: stats.cells.size })}`,
      )
      expect(stats.pixels + stats.background).toBe(16 * SIZE * SIZE)
      expect(stats.colours.size).toBeGreaterThan(3_000_000)
      expect(stats.cells.size).toBe(16)
      expect(stats.differ).toBe(0)
      expect(stats.notPalette).toBe(0)
    }, 600_000)
  }
})

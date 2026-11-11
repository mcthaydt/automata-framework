// A baked room on a real context: what reaches the screen is the surface's colour times its light, and a level's
// room lit by its own lamps and time is not a dark frame. Headless Firefox here has no WebGL, so these skip there.
import '#src/entries/no-eval.ts'
import { afterEach, describe, expect, it } from 'vitest'
import { createPixi3dRenderer, type Pixi3dRenderer } from '#src/app/create-renderer.ts'
import { worldLighting } from '#src/app/world-lighting.ts'
import { drawWorld } from '#src/app/world-view.ts'
import { baseLibrary } from '#src/features/world/base/base-library.ts'
import { BASE_SCENES } from '#src/features/world/base/base-scenes.ts'
import { buildWorld } from '#src/features/world/build.ts'
import { swatchColour } from '#src/features/world/swatches.ts'
import { sceneLightingSchema } from '#src/shared/render/light/scene-lighting.schema.ts'
import { levelTime } from '#src/shared/time-of-day/time-light.ts'
import { builtRenderer } from '#src/testing/built-renderer.ts'
import { snapshot } from '#src/testing/snapshot.ts'
import { testTarget } from '#src/testing/test-target.ts'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null
const WIDTH = 160
const HEIGHT = 100
const frame = { alpha: 1, frameMs: 16, paused: false }

let scope: { dispose(): void } | undefined
afterEach(() => {
  scope?.dispose()
  scope = undefined
  document.body.replaceChildren()
})

async function start(options: Parameters<typeof createPixi3dRenderer>[0]): Promise<Pixi3dRenderer> {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const renderer = await builtRenderer(createPixi3dRenderer(options)(testTarget(host)))
  scope = renderer
  return renderer
}

/** The mean of red, green and blue over the whole frame, 0 to 255. */
const brightness = (pixels: ArrayLike<number>): number => {
  let total = 0
  for (let i = 0; i < pixels.length; i += 4)
    total += ((pixels[i] ?? 0) + (pixels[i + 1] ?? 0) + (pixels[i + 2] ?? 0)) / 3
  return total / (pixels.length / 4)
}

describe.runIf(hasWebGL2)('a baked room on WebGL2', () => {
  it('shows the colour times the light: a mid grey room under half light is a quarter grey', async () => {
    // Ambient alone, no lamp, key, fill or step: every surface's light is exactly 0.5.
    const lighting = sceneLightingSchema.parse({ ambient: 0.5, colorSpace: 'srgb', lamps: [] })
    const world = buildWorld(BASE_SCENES['base-interior'], baseLibrary)
    const renderer = await start({
      logicalWidth: WIDTH,
      logicalHeight: HEIGHT,
      backgroundColor: 0x000000,
      views: {},
      lighting,
      scene: (view, _stage, _occluders, light) => {
        view.camera.fov = 64
        view.camera.position.set(0, 1.6, 2.2)
        view.camera.lookAt({ x: 0, y: 1.6, z: -2.5 })
        // Every swatch is the one grey, and no tiles: the frame is one flat colour times one light.
        drawWorld({ parent: view.root, colourOf: () => 0x808080, light }, world.pieces)
        return undefined
      },
    })
    renderer.draw(frame)
    const pixels = snapshot(renderer)
    const centre = (Math.floor(HEIGHT / 2) * WIDTH + Math.floor(WIDTH / 2)) * 4
    const seen = [pixels[centre], pixels[centre + 1], pixels[centre + 2]]
    // 0x80 × 0.5 = 64 in the display's own units. The fault this guards showed that product to the power 2.2: 13.
    for (const channel of seen)
      expect(Math.abs((channel ?? 0) - 64), `saw ${seen.join(', ')}`).toBeLessThanOrEqual(4)
  })

  it('the base interior, lit by its lamp at its own time, is not a dark frame', async () => {
    const level = BASE_SCENES['base-interior']
    const time = levelTime(level.time)
    const world = buildWorld(level, baseLibrary, { night: time.name !== 'day' })
    const renderer = await start({
      logicalWidth: WIDTH,
      logicalHeight: HEIGHT,
      backgroundColor: 0x000000,
      views: {},
      time,
      lighting: worldLighting(world, time),
      scene: (view, _stage, _occluders, light) => {
        // First person from the door, as the builder frames the room: every pixel is a wall, the floor or the ceiling.
        view.camera.fov = 64
        view.camera.position.set(0, 1.6, 2.2)
        view.camera.lookAt({ x: 0, y: 1.6, z: -2.5 })
        drawWorld(
          { parent: view.root, colourOf: (swatch) => swatchColour(baseLibrary, swatch), light },
          world.pieces,
        )
        return undefined
      },
    })
    renderer.draw(frame)
    // The builder's own first-person frame of this room reads 47.8; the fault this guards read under 23.
    expect(brightness(snapshot(renderer))).toBeGreaterThan(32)
  })
})

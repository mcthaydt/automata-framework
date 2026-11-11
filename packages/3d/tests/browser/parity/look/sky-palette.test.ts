// The sky ends on the palette. The sky is a pass that runs before the haze, the grade and the snap, so every pixel it draws
// is snapped with the rest; a pixel nothing draws (no sky pass, only the page's background colour) is the page's own and is
// not. WebGPU and WebGL2 parity is the GPU runner's.
import '#src/entries/no-eval.ts'
import { DEFAULT_PALETTE } from '@automata/content/palette'
import { CubeGeometry, FlatMaterial, Mesh3D } from '@pixi/3d'
import { afterEach, describe, expect, it } from 'vitest'
import { createPixi3dRenderer, type Pixi3dRenderer } from '#src/app/create-renderer.ts'
import { DEFAULT_LOOK } from '#src/features/look/look.ts'
import { SkyEffect } from '#src/features/look/sky-pass.ts'
import { timeOfDay } from '#src/shared/time-of-day/time-of-day.ts'
import { builtRenderer } from '#src/testing/built-renderer.ts'
import { snapshot } from '#src/testing/snapshot.ts'
import { testTarget } from '#src/testing/test-target.ts'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null
const frame = { alpha: 1, frameMs: 16, paused: false }
const BAR = 5
const PALETTE = new Set(DEFAULT_PALETTE.colors.map((hex) => Number.parseInt(hex.slice(1), 16)))

let scope: { dispose(): void } | undefined
afterEach(() => {
  scope?.dispose()
  scope = undefined
  document.body.replaceChildren()
})

async function start(name: string): Promise<Pixi3dRenderer> {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const time = timeOfDay(name)
  const factory = createPixi3dRenderer({
    logicalWidth: 160,
    logicalHeight: 90,
    backgroundColor: 0x2e222f,
    views: {},
    look: DEFAULT_LOOK,
    time,
    scene: (view) => {
      view.camera.position.set(0, 1, 5)
      view.camera.lookAt({ x: 0, y: 1, z: 0 })
      view.root.addChild(
        new Mesh3D({ geometry: new CubeGeometry(), material: new FlatMaterial({ baseColor: 0x96b2d9 }) }),
      )
      view.passes = [new SkyEffect(time), ...view.passes]
      return undefined
    },
  })
  const renderer = await builtRenderer(factory(testTarget(host, {})))
  scope = renderer
  return renderer
}

describe.runIf(hasWebGL2)('the sky on WebGL2', () => {
  it.each(['day', 'dusk', 'night'])('leaves every pixel of the %s frame on the palette', async (name) => {
    const renderer = await start(name)
    for (let i = 0; i < 4; i++) renderer.draw(frame)
    const pixels = snapshot(renderer)
    const off: string[] = []
    for (let i = 0; i < pixels.length; i += 4) {
      const colour = ((pixels[i] ?? 0) << 16) | ((pixels[i + 1] ?? 0) << 8) | (pixels[i + 2] ?? 0)
      // The view's field is a little shorter than the canvas: the bars above and below it are the page's background.
      const row = Math.floor(i / 4 / 160)
      if (row >= BAR && row < 90 - BAR && !PALETTE.has(colour)) off.push(colour.toString(16))
    }
    expect(off).toEqual([])
  })
})

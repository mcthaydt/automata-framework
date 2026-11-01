// The full-page view under a height cap on a real context (G3-x): it draws at the capped size and the page shows it
// nearest-upscaled. Headless Firefox in this container has no WebGL, so there these skip (the GPU runner runs them).
import '../no-eval.js'
import type { RenderRow, StepResult } from '@mcthaydt/automata-sim'
import { DirectionalLight } from '@pixi/3d'
import { Effect, Exit, Scope } from 'effect'
import { afterEach, describe, expect, it } from 'vitest'
import { createPixi3dRenderer, type Pixi3dRenderer } from '../renderer/create-pixi3d-renderer.js'
import { snapshot } from '../testing/snapshot.js'
import { testTarget } from '../testing/test-target.js'
import { box } from '../views/box-view.js'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null
const frame = { alpha: 1, frameMs: 16, paused: false }
const step = (render: StepResult['render']): StepResult => ({ tick: 0, events: [], render, rejected: [] })
const rows: RenderRow[] = [{ sid: 1, components: { crate: { x: 0, y: 0, z: 0 } } }]

let scope: Scope.CloseableScope | undefined
afterEach(async () => {
  if (scope) await Effect.runPromise(Scope.close(scope, Exit.void))
  scope = undefined
  document.body.replaceChildren()
})

async function start(maxInternalHeight: number | undefined): Promise<Pixi3dRenderer> {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const factory = createPixi3dRenderer({
    backgroundColor: 0x2e222f,
    maxInternalHeight,
    views: { crate: box({ width: 1, height: 1, depth: 1 }, { color: 0xf9c22b }) },
    scene: (view) => {
      view.camera.position.set(0, 2.5, 5)
      view.camera.lookAt({ x: 0, y: 0.5, z: 0 })
      const sun = new DirectionalLight({ intensity: 2 })
      sun.rotation.set(-0.8, 0.5, 0)
      view.root.addChild(sun)
      return undefined
    },
  })
  scope = Effect.runSync(Scope.make())
  const renderer = await Effect.runPromise(Scope.extend(factory(testTarget(host)), scope))
  renderer.apply(step({ resync: true, added: rows, changed: [], removed: [] }))
  return renderer
}

/** How many 2 × 2 blocks (from even coordinates) hold more than one colour. */
function mixedBlocks(pixels: ArrayLike<number>, width: number, height: number): number {
  const at = (x: number, y: number) => {
    const i = (y * width + x) * 4
    return `${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`
  }
  let mixed = 0
  for (let y = 0; y + 1 < height; y += 2)
    for (let x = 0; x + 1 < width; x += 2) {
      const c = at(x, y)
      if (at(x + 1, y) !== c || at(x, y + 1) !== c || at(x + 1, y + 1) !== c) mixed++
    }
  return mixed
}

/** How many pixels are the crate's yellow-ish lit faces (red and green high, blue low). */
function crateish(pixels: ArrayLike<number>): number {
  let count = 0
  for (let i = 0; i < pixels.length; i += 4)
    if ((pixels[i] ?? 0) > 120 && (pixels[i + 1] ?? 0) > 80 && (pixels[i + 2] ?? 0) < 80) count++
  return count
}

describe.runIf(hasWebGL2)('a full-page View3D under maxInternalHeight', () => {
  it('draws at the capped size and shows it nearest-upscaled over the whole page', async () => {
    const renderer = await start(45)
    renderer.draw(frame)
    expect(renderer.view.width).toBe(80)
    expect(renderer.view.height).toBe(45)
    const { app } = renderer.stage
    const gl = (app.renderer as unknown as { gl: WebGL2RenderingContext }).gl
    const pixels = snapshot(renderer)
    expect(crateish(pixels)).toBeGreaterThan(100)
    // Drawn at half the page's size and doubled with nearest sampling: every 2 × 2 block is one colour.
    expect(mixedBlocks(pixels, gl.drawingBufferWidth, gl.drawingBufferHeight)).toBe(0)
  })

  it('follows the screen without a cap, as before', async () => {
    const renderer = await start(undefined)
    renderer.draw(frame)
    expect(renderer.view.width).toBe(160)
    expect(renderer.view.height).toBe(90)
    expect(crateish(snapshot(renderer))).toBeGreaterThan(100)
  })
})

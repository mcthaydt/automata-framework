// Lighting and fog on a real context (M3.4d): D3-e end to end, through the render rows. Headless Firefox in this
// container has no WebGL, so these skip there and the GPU runner runs them (M3.1b).
import '../no-eval.js'
import type { RenderRow, StepResult } from '@mcthaydt/automata-sim'
import { FlatMaterial, Mesh3D, PlaneGeometry } from '@pixi/3d'
import { Effect, Exit, Scope } from 'effect'
import { RenderTexture } from 'pixi.js'
import { afterEach, describe, expect, it } from 'vitest'
import { sceneLightingSchema } from '../light/scene-lighting.schema.js'
import { createPixi3dRenderer, type Pixi3dRenderer } from '../renderer/create-pixi3d-renderer.js'
import { testTarget } from '../testing/test-target.js'
import { box } from '../views/box-view.js'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null
const WIDTH = 160
const frame = { alpha: 1, frameMs: 16, paused: false }
const step = (render: StepResult['render']): StepResult => ({ tick: 0, events: [], render, rejected: [] })

// Two lamps 6 m apart over a floor, each reaching only its own half; a lit box stands under each.
const lighting = sceneLightingSchema.parse({
  ambient: 0.2,
  lamps: [
    { id: 'west', x: -3, y: 1.5, z: 0, color: 0xffcc80, strength: 2, range: 2.8 },
    { id: 'east', x: 3, y: 1.5, z: 0, color: 0x80c0ff, strength: 2, range: 2.8 },
  ],
})
const characters: RenderRow[] = [
  { sid: 1, components: { walker: { x: -3, y: 0, z: 1 } } },
  { sid: 2, components: { walker: { x: 3, y: 0, z: 1 } } },
]

let scope: Scope.CloseableScope | undefined
afterEach(async () => {
  if (scope) await Effect.runPromise(Scope.close(scope, Exit.void))
  scope = undefined
  document.body.replaceChildren()
})

async function start(fog?: { near: number; far: number; color: number }): Promise<Pixi3dRenderer> {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const factory = createPixi3dRenderer({
    logicalWidth: WIDTH,
    logicalHeight: 90,
    backgroundColor: 0x000000,
    views: { walker: box({ width: 0.6, height: 1, depth: 0.6 }, { color: 0xffffff, lit: 'moving' }) },
    lighting,
    lamps: 'lamp',
    fog,
    scene: (view, _stage, light) => {
      view.camera.position.set(0, 5, 7)
      view.camera.lookAt({ x: 0, y: 0, z: 0 })
      for (const x of [-3, 3]) {
        const floor = new Mesh3D({
          geometry: new PlaneGeometry({ width: 5.8, height: 6, widthSegments: 12, heightSegments: 12 }),
          material: new FlatMaterial({ baseColor: 0xffffff }),
        })
        floor.position.set(x, 0, 0)
        floor.rotation.set(-Math.PI / 2, 0, 0)
        view.root.addChild(floor)
        light?.bake(floor)
      }
      return undefined
    },
  })
  scope = Effect.runSync(Scope.make())
  return Effect.runPromise(Scope.extend(factory(testTarget(host)), scope))
}

function snapshot(renderer: Pixi3dRenderer): Uint8ClampedArray | Uint8Array {
  const { app } = renderer.stage
  const texture = RenderTexture.create({ width: app.screen.width, height: app.screen.height, resolution: 1 })
  app.renderer.render({ container: app.stage, target: texture, clear: true })
  const { pixels } = app.renderer.extract.pixels(texture)
  texture.destroy(true)
  return pixels
}

/** Pixels in columns [from, to) that got darker / changed at all between two snapshots, by more than a rounding step. */
function compare(a: ArrayLike<number>, b: ArrayLike<number>, from: number, to: number) {
  let darker = 0
  let changed = 0
  for (let i = 0; i < a.length; i += 4) {
    const column = (i / 4) % WIDTH
    if (column < from || column >= to) continue
    const before = (a[i] ?? 0) + (a[i + 1] ?? 0) + (a[i + 2] ?? 0)
    const after = (b[i] ?? 0) + (b[i + 1] ?? 0) + (b[i + 2] ?? 0)
    if (Math.abs(before - after) > 6) changed++
    if (before - after > 6) darker++
  }
  return { darker, changed }
}

describe.runIf(hasWebGL2)('lighting and fog on WebGL2', () => {
  it('D3-e: a lamp switched off by a sim entity darkens its side, and only its side', async () => {
    const renderer = await start()
    renderer.apply(step({ resync: true, added: characters, changed: [], removed: [] }))
    renderer.draw(frame)
    const on = snapshot(renderer)

    renderer.apply(
      step({
        resync: false,
        added: [{ sid: 9, components: { lamp: { lamp: 'west', level: 0 } } }],
        changed: [],
        removed: [],
      }),
    )
    renderer.draw(frame)
    const off = snapshot(renderer)

    // The west lamp lit the left of the frame: hundreds of its pixels darken. The east half is untouched.
    expect(compare(on, off, 0, WIDTH / 2 - 8).darker).toBeGreaterThan(300)
    expect(compare(on, off, WIDTH / 2 + 8, WIDTH).changed).toBe(0)

    // Removing the switch hands the lamp back to its content level: the frame is as before.
    renderer.apply(step({ resync: false, added: [], changed: [], removed: [9] }))
    renderer.draw(frame)
    expect(compare(on, snapshot(renderer), 0, WIDTH).changed).toBe(0)
  })

  it('fog from the options turns the far floor toward the fog colour', async () => {
    const clear = await start()
    clear.draw(frame)
    const without = snapshot(clear)
    if (scope) await Effect.runPromise(Scope.close(scope, Exit.void))
    document.body.replaceChildren()
    const foggy = await start({ near: 4, far: 10, color: 0x3e3546 })
    expect(foggy.view.fog).toMatchObject({ type: 'linear', near: 4, far: 10 })
    foggy.draw(frame)
    expect(compare(without, snapshot(foggy), 0, WIDTH).changed).toBeGreaterThan(300)
  })
})

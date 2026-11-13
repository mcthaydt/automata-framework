// Every pass of the look compiles as WGSL: the haze, the grade, the DUEL snap, the outline, the sky and the present pass. A compile error
// neither throws nor reaches `uncapturederror` (the pass's pipeline is invalid and the frame goes black, `shader-compile.ts`), and the
// WebGL2 cases cannot see one, so nothing else says a WGSL source is wrong. A machine with no WebGPU adapter skips with the reason.
import '#src/entries/no-eval.ts'
import { CubeGeometry, FlatMaterial, Mesh3D } from '@pixi/3d'
import { afterEach, describe, expect, it } from 'vitest'
import { createPixi3dRenderer } from '#src/app/create-renderer.ts'
import { parseLook } from '#src/features/look/look.ts'
import { SkyEffect } from '#src/features/look/sky-pass.ts'
import { timeOfDay } from '#src/shared/time-of-day/time-of-day.ts'
import { builtRenderer } from '#src/testing/built-renderer.ts'
import { watchShaderCompile } from '#src/testing/shader-compile.ts'
import { testTarget } from '#src/testing/test-target.ts'
import { notOnWebGpu } from '#src/testing/webgpu-skip.ts'

const frame = { alpha: 1, frameMs: 16, paused: false }

let scope: { dispose(): void } | undefined
afterEach(() => {
  scope?.dispose()
  scope = undefined
  document.body.replaceChildren()
})

describe('the look on WebGPU', () => {
  it('compiles every pass with the outline and the sky on', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const time = timeOfDay('dusk')
    const renderer = await builtRenderer(
      createPixi3dRenderer({
        logicalWidth: 160,
        logicalHeight: 90,
        backgroundColor: 0x2e222f,
        views: {},
        preference: 'webgpu',
        look: parseLook({ switches: { outline: true } }),
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
      })(testTarget(host, {})),
    )
    scope = renderer
    const app = renderer.stage.app.renderer
    const fellBack = notOnWebGpu(app)
    if (fellBack !== undefined) return
    const compile = watchShaderCompile(app)
    for (let i = 0; i < 4; i++) renderer.draw(frame)
    const names = renderer.view.passes.map((p) => p.constructor.name)
    expect(names).toEqual(
      expect.arrayContaining(['SkyEffect', 'HazeEffect', 'GradeEffect', 'DuelSnapEffect', 'OutlineEffect']),
    )
    expect(await compile.settle()).toEqual([])
  })
})

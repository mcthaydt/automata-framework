// The renderer with the angled camera (M3.4b) on a real context: the player's row drives the View3D's camera, which
// stands at the Owner's view behind the followed position on a 24 mm lens. Headless Firefox here has no WebGL, so
// this skips there and the GPU runner runs it (M3.1b).
import '../no-eval.js'
import type { RenderRow, StepResult } from '@mcthaydt/automata-sim'
import { Effect, Exit, Scope } from 'effect'
import { afterEach, describe, expect, it } from 'vitest'
import { eyeOf } from '../camera/camera-pose.js'
import { createPixi3dRenderer } from '../renderer/create-pixi3d-renderer.js'
import { cameraView } from '../sim/camera-view.schema.js'
import { testTarget } from '../testing/test-target.js'
import { box } from '../views/box-view.js'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null
const step = (render: StepResult['render']): StepResult => ({ tick: 0, events: [], render, rejected: [] })

let scope: Scope.CloseableScope | undefined
afterEach(async () => {
  if (scope) await Effect.runPromise(Scope.close(scope, Exit.void))
  scope = undefined
  document.body.replaceChildren()
})

describe.runIf(hasWebGL2)('createPixi3dRenderer with the angled camera', () => {
  it('puts the View3D camera at the player’s view, 24 mm, and exposes the rig', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const factory = createPixi3dRenderer({
      logicalWidth: 160,
      logicalHeight: 90,
      views: { body: box({ width: 0.5, height: 1.62, depth: 0.3 }, { color: 0xf9c22b }) },
      camera: { views: [cameraView('hall')], initial: 'hall', follow: 'body' },
    })
    scope = Effect.runSync(Scope.make())
    const renderer = await Effect.runPromise(Scope.extend(factory(testTarget(host)), scope))
    expect(renderer.camera?.lensMm).toBe(24)
    const row: RenderRow = {
      sid: 1,
      components: { body: { x: 1, y: 0, z: 2 }, 'camera-heading': { view: 'hall', heading: 16_384 } },
    }
    renderer.apply(step({ resync: true, added: [row], changed: [], removed: [] }))
    renderer.draw({ alpha: 1, frameMs: 16, paused: false })
    const eye = eyeOf({ x: 1, y: 1, z: 2 }, 90, 25, 5)
    const { position, fov } = renderer.view.camera
    expect(position.x).toBeCloseTo(eye.x, 4)
    expect(position.y).toBeCloseTo(eye.y, 4)
    expect(position.z).toBeCloseTo(eye.z, 4)
    expect(fov).toBeCloseTo(53.13, 2)
  })
})

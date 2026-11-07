// The occluder rule in the renderer (M3.4c) on a real context: the `scene` hook gets `occluders`, and with the angled
// camera a drawn frame cuts the wall between the camera and the player (showing its trim), hides the ceiling and fades
// a pillar on the line to 25%. Headless Firefox here has no WebGL, so this skips there and the GPU runner runs it.
import '#src/entries/no-eval.ts'
import type { RenderRow, StepResult } from '@automata/sim'
import { Container3D, CubeGeometry, Mesh3D, PhongMaterial } from '@pixi/3d'
import { afterEach, describe, expect, it } from 'vitest'
import { createPixi3dRenderer } from '#src/app/create-renderer.ts'
import type { Occluders } from '#src/features/camera/occluders/occluders.ts'
import { cameraView } from '#src/features/camera/sim/camera-view.schema.ts'
import { box } from '#src/shared/render/views/box-view.ts'
import { builtRenderer } from '#src/testing/built-renderer.ts'
import { testTarget } from '#src/testing/test-target.ts'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null
const step = (render: StepResult['render']): StepResult => ({ tick: 0, events: [], render, rejected: [] })

/** The renderer the test built, disposed after it. */
let scope: { dispose(): void } | undefined
afterEach(async () => {
  scope?.dispose()
  scope = undefined
  document.body.replaceChildren()
})

describe.runIf(hasWebGL2)('createPixi3dRenderer with occluders', () => {
  it('cuts the near wall, hides the ceiling and fades the pillar on the line to the player', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const made: { south?: Container3D; north?: Container3D; ceiling?: Container3D; pillar?: Mesh3D } = {}
    const factory = createPixi3dRenderer({
      logicalWidth: 160,
      logicalHeight: 90,
      views: { body: box({ width: 0.5, height: 1.62, depth: 0.3 }, { color: 0xf9c22b }) },
      camera: { views: [cameraView('hall')], initial: 'hall', follow: 'body' },
      scene: (view, _stage, occluders: Occluders) => {
        // A 6 m room from the origin; the camera looks +z from heading 0, so the south wall (z 0) is the near one.
        made.south = occluders.wall({ a: { x: 0, z: 0 }, b: { x: 6, z: 0 }, height: 2.5, color: 0x6d758d })
        made.north = occluders.wall({ a: { x: 6, z: 6 }, b: { x: 0, z: 6 }, height: 2.5, color: 0x6d758d })
        made.ceiling = new Container3D()
        view.root.addChild(made.ceiling)
        occluders.ceiling(made.ceiling)
        made.pillar = new Mesh3D({ geometry: new CubeGeometry(), material: new PhongMaterial() })
        view.root.addChild(made.pillar)
        occluders.prop(made.pillar, { bounds: { min: [2.8, 0, 1.4], max: [3.2, 2.4, 1.8] } })
        return undefined
      },
    })
    const renderer = await builtRenderer(factory(testTarget(host)))
    scope = renderer
    const row: RenderRow = {
      sid: 1,
      components: { body: { x: 3, y: 0, z: 3 }, 'camera-heading': { view: 'hall', heading: 0 } },
    }
    renderer.apply(step({ resync: true, added: [row], changed: [], removed: [] }))
    // Long enough for every 150 ms fade to finish.
    for (let i = 0; i < 3; i++) renderer.draw({ alpha: 1, frameMs: 100, paused: false })
    const [southWall, southTrim] = (made.south?.children ?? []) as Mesh3D[]
    const [northWall] = (made.north?.children ?? []) as Mesh3D[]
    expect([southWall?.visible, southTrim?.visible]).toEqual([false, true])
    expect(northWall?.visible).toBe(true)
    expect(made.ceiling?.visible).toBe(false)
    expect(made.pillar?.material.alpha).toBe(0.25)
  })
})

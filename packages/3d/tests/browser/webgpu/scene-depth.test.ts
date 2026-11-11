// A known `@pixi/3d` 0.1.0-beta.2 hazard on WebGPU (WP0, 2026-11-10), with no AF code in it: once a `PostEffect` has run,
// a mesh added to the view makes every later frame invalid ("Texture sceneDepth ... usage includes writable usage and
// another usage in the same synchronization scope"), so the frame is dropped. Every effect declares a read of
// `graph.sceneDepth`, which `sample` binds in the shared global bind group's opaque-depth slot; the forward pass's
// render bundle, re-recorded when the draw list changes, then captures that slot still holding `sceneDepth`, which the
// same pass attaches for writing. The controls stay clean, so only the re-record triggers it.
//
// `it.fails` documents the bug and flips red when a @pixi/3d release fixes it: then it becomes a plain `it` (and the
// look's WebGPU frames stop dropping when a figure or prop is added).
import { CubeGeometry, FlatMaterial, Mesh3D, PostEffect, View3D } from '@pixi/3d'
import { Application, UniformGroup } from 'pixi.js'
import { describe, expect, it } from 'vitest'

const hasWebGpu =
  typeof navigator !== 'undefined' && 'gpu' in navigator
    ? (await (navigator as Navigator & { gpu: GPU }).gpu.requestAdapter().catch(() => null)) !== null
    : false

/** The smallest effect: it passes the colour through. */
class Passthrough extends PostEffect {
  protected override readonly fragment = {
    gpu: 'fn effect(uv: vec2<f32>) -> vec4<f32> { return sampleColor(uv); }',
    gl: 'vec4 effect(vec2 uv) { return sampleColor(uv); }',
  }
  protected override readonly uniforms = new UniformGroup({})
}

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))

/** What the device reported over 40 frames of one cube and a Passthrough effect, with `change` done at frame 10. */
async function problemsAfter(change: (view: View3D, cube: Mesh3D) => void): Promise<string[]> {
  const app = new Application()
  await app.init({ preference: 'webgpu', width: 160, height: 90, backgroundColor: 0x2e222f })
  document.body.appendChild(app.canvas)
  const problems: string[] = []
  const { device } = (app.renderer as unknown as { gpu: { device: GPUDevice } }).gpu
  device.addEventListener('uncapturederror', (event) =>
    problems.push((event as GPUUncapturedErrorEvent).error.message),
  )
  void device.lost.then((info) => problems.push(`device lost: ${info.reason}`))
  const view = new View3D({ width: 160, height: 90, toneMapping: 'none' })
  view.passes = [new Passthrough()]
  app.stage.addChild(view)
  view.camera.position.set(0, 2, 5)
  view.camera.lookAt({ x: 0, y: 0.5, z: 0 })
  const cube = new Mesh3D({
    geometry: new CubeGeometry({ width: 1, height: 1, depth: 1 }),
    material: new FlatMaterial({ baseColor: [0.9, 0.7, 0.2, 1] as never }),
  })
  view.root.addChild(cube)
  for (let frame = 0; frame < 40; frame++) {
    if (frame === 10) change(view, cube)
    app.render()
    await nextFrame()
  }
  // The device reports a few frames late.
  await new Promise((resolve) => setTimeout(resolve, 400))
  app.destroy(true)
  document.body.replaceChildren()
  return problems
}

describe.runIf(hasWebGpu)('@pixi/3d on WebGPU with a post effect', () => {
  it('stays valid while the scene holds still and while a mesh moves or hides', async () => {
    const still = await problemsAfter(() => {})
    expect(still).toEqual([])
    const moved = await problemsAfter((_view, cube) => cube.position.set(0.5, 0, 0))
    expect(moved).toEqual([])
    const hidden = await problemsAfter((_view, cube) => {
      cube.visible = false
    })
    expect(hidden).toEqual([])
  }, 60_000)

  it.fails('stays valid after a mesh is added (a bundle re-record), but does not yet', async () => {
    const problems = await problemsAfter((view) => {
      const second = new Mesh3D({
        geometry: new CubeGeometry({ width: 1, height: 1, depth: 1 }),
        material: new FlatMaterial({ baseColor: [0.2, 0.7, 0.9, 1] as never }),
      })
      second.position.set(1.5, 0, 0)
      view.root.addChild(second)
    })
    expect(problems).toEqual([])
  }, 60_000)
})

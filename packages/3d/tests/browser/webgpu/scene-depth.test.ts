// A known `@pixi/3d` 0.1.0-beta.2 hazard on WebGPU (WP0, 2026-11-10): once a `PostEffect` has run, a mesh added to the
// view makes every later frame invalid ("Texture sceneDepth ... usage includes writable usage and another usage in the
// same synchronization scope"), so the frame is dropped. Every effect declares a read of `graph.sceneDepth`, which
// `sample` binds in the shared global bind group's opaque-depth slot; the forward pass's render bundle, re-recorded when
// the draw list changes, then captures that slot still holding `sceneDepth`, which the same pass attaches for writing.
//
// AF's look keeps clear of it: a `PresentEffect` ends the chain and puts the engine's empty depth back in the slot
// (`features/look/present-pass.ts`). The bare effect alone still has the hazard, so these tests run the chain the look
// builds: an effect that samples the depth, then the present pass.
import { CubeGeometry, FlatMaterial, Mesh3D, PostEffect, View3D } from '@pixi/3d'
import { Application, UniformGroup } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { PresentEffect } from '#src/features/look/present-pass.ts'
import { adapterGone, notOnWebGpu } from '#src/testing/webgpu-skip.ts'

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

interface Reported {
  /** What the device reported: validation errors, and why it was lost, if it was. */
  readonly problems: string[]
  /** Why this machine could not judge it (no WebGPU adapter, or it went away), if it could not. */
  readonly unjudged?: string
}

/** What the device reported over 40 frames of one cube, a Passthrough effect that samples the depth and the present pass, with `change` done at frame 10. */
async function problemsAfter(change: (view: View3D, cube: Mesh3D) => void): Promise<Reported> {
  const app = new Application()
  try {
    await app.init({ preference: 'webgpu', width: 160, height: 90, backgroundColor: 0x2e222f })
  } catch (error) {
    // An adapter that was there when the machine was probed can be gone by now (the GPU runner's): that is the machine's.
    const message = error instanceof Error ? error.message : String(error)
    if (/No GPU adapter|WebGPU not supported/.test(message)) return { problems: [], unjudged: message }
    throw error
  }
  const fellBack = notOnWebGpu(app.renderer)
  if (fellBack !== undefined) {
    app.destroy(true)
    return { problems: [], unjudged: fellBack }
  }
  document.body.appendChild(app.canvas)
  const problems: string[] = []
  let lost = false
  const { device } = (app.renderer as unknown as { gpu: { device: GPUDevice } }).gpu
  device.addEventListener('uncapturederror', (event) =>
    problems.push((event as GPUUncapturedErrorEvent).error.message),
  )
  void device.lost.then((info) => {
    lost = true
    problems.push(`device lost: ${info.reason}`)
  })
  const view = new View3D({ width: 160, height: 90, toneMapping: 'none' })
  view.passes = [new Passthrough(), new PresentEffect()]
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
  const gone = lost ? await adapterGone() : undefined
  return gone === undefined ? { problems } : { problems, unjudged: gone }
}

describe.runIf(hasWebGpu)('@pixi/3d on WebGPU with a post effect and the present pass', () => {
  it('stays valid while the scene holds still and while a mesh moves or hides', async ({ skip }) => {
    const changes: ((view: View3D, cube: Mesh3D) => void)[] = [
      () => {},
      (_view, cube) => cube.position.set(0.5, 0, 0),
      (_view, cube) => {
        cube.visible = false
      },
    ]
    for (const change of changes) {
      const { problems, unjudged } = await problemsAfter(change)
      if (unjudged !== undefined) return skip(unjudged)
      expect(problems).toEqual([])
    }
  }, 60_000)

  it('stays valid after a mesh is added (a bundle re-record)', async ({ skip }) => {
    const { problems, unjudged } = await problemsAfter((view) => {
      const second = new Mesh3D({
        geometry: new CubeGeometry({ width: 1, height: 1, depth: 1 }),
        material: new FlatMaterial({ baseColor: [0.2, 0.7, 0.9, 1] as never }),
      })
      second.position.set(1.5, 0, 0)
      view.root.addChild(second)
    })
    if (unjudged !== undefined) return skip(unjudged)
    expect(problems).toEqual([])
  }, 60_000)
})

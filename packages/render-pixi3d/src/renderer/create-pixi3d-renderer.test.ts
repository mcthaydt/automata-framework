import '../no-eval.js'
import { Effect, Exit, Scope } from 'effect'
import { describe, expect, it } from 'vitest'
import { encodeGlb, fixtureBox } from '../model/testing/model-fixtures.js'
import { testTarget } from '../testing/test-target.js'
import { box } from '../views/box-view.js'
import { mesh } from '../views/mesh-view.js'
import { acceptsRenderer, createPixi3dRenderer } from './create-pixi3d-renderer.js'

/** A host that records whether anything was mounted into it. */
const recordingHost = () => {
  const children: unknown[] = []
  return {
    children,
    appendChild: (child: unknown) => void children.push(child),
  } as unknown as HTMLElement & {
    children: unknown[]
  }
}

const run = async (factory: ReturnType<typeof createPixi3dRenderer>, host: HTMLElement, files = {}) => {
  const scope = Effect.runSync(Scope.make())
  const exit = await Effect.runPromiseExit(Scope.extend(factory(testTarget(host, files)), scope))
  await Effect.runPromise(Scope.close(scope, Exit.void))
  return exit
}

describe('createPixi3dRenderer before any Pixi app exists', () => {
  it('fails with ModelInvalid for a skinned model and mounts nothing (D3-f)', async () => {
    const host = recordingHost()
    const factory = createPixi3dRenderer({
      views: { prop: mesh('models/hero.glb'), crate: box({ width: 1, height: 1, depth: 1 }, { color: 1 }) },
    })
    const exit = await run(factory, host, { 'models/hero.glb': encodeGlb(fixtureBox(), { skinned: true }) })
    expect(Exit.isFailure(exit) && JSON.stringify(exit.cause.toJSON())).toContain('"reason":"skinned"')
    expect(host.children).toEqual([])
  })

  it('fails with ModelInvalid for a model file the game did not preload', async () => {
    const exit = await run(
      createPixi3dRenderer({ views: { prop: mesh('models/desk.glb') } }),
      recordingHost(),
    )
    expect(Exit.isFailure(exit) && JSON.stringify(exit.cause.toJSON())).toContain('"reason":"not loaded"')
  })
  it("loads the scene's own model files with the views' (M3.7b part 3a): a skinned one fails boot the same way", async () => {
    const host = recordingHost()
    const factory = createPixi3dRenderer({ views: {}, models: ['models/bench.glb'] })
    const exit = await run(factory, host, { 'models/bench.glb': encodeGlb(fixtureBox(), { skinned: true }) })
    expect(Exit.isFailure(exit) && JSON.stringify(exit.cause.toJSON())).toContain('"reason":"skinned"')
    expect(host.children).toEqual([])
  })
})

describe('acceptsRenderer', () => {
  it('takes WebGL2 and WebGPU and refuses Canvas and WebGL1 (S7-Q1: a View3D on Canvas draws nothing)', () => {
    expect(acceptsRenderer({ name: 'webgl', context: { webGLVersion: 2 } })).toBe(true)
    expect(acceptsRenderer({ name: 'webgpu' })).toBe(true)
    expect(acceptsRenderer({ name: 'webgl', context: { webGLVersion: 1 } })).toBe(false)
    expect(acceptsRenderer({ name: 'canvas' })).toBe(false)
  })
})

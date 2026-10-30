import { resolveExtensions } from '@mcthaydt/automata-runtime/extension'
import { describe, expect, it } from 'vitest'
import { render3dExtension } from './render3d.extension.js'

describe('render3dExtension', () => {
  it('is the render-pixi3d extension, with nothing for the sim, the content or ruken.toml in part 1', () => {
    expect(render3dExtension.name).toBe('render-pixi3d')
    expect(render3dExtension.sim).toBeUndefined()
    expect(render3dExtension.content).toBeUndefined()
    // runtime.renderer stays webgl2 (Ruken has no WebGPU value, R-8); the models come in through the preload.
    expect(render3dExtension.manifest).toBeUndefined()
  })

  it('resolves beside other extensions', () => {
    const resolved = resolveExtensions([render3dExtension])
    expect(resolved.order).toEqual(['render-pixi3d'])
    expect(resolved.simPlugins).toEqual([])
  })
})

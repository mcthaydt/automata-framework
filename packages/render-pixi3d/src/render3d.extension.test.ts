import { resolveExtensions } from '@mcthaydt/automata-runtime/extension'
import { describe, expect, it } from 'vitest'
import { cameraViewContent } from './camera/camera-view.content.js'
import { sceneLightingContent } from './light/scene-lighting.content.js'
import { render3dExtension } from './render3d.extension.js'
import { cameraHeadingPlugin } from './sim/camera-heading.plugin.js'
import { cameraViewSchema } from './sim/camera-view.schema.js'

describe('render3dExtension', () => {
  it('is the render-pixi3d extension, bringing the camera’s heading to the sim and camera-view to the content', () => {
    expect(render3dExtension.name).toBe('render-pixi3d')
    expect(render3dExtension.sim).toEqual([cameraHeadingPlugin])
    expect(render3dExtension.content).toEqual([cameraViewContent, sceneLightingContent])
    // runtime.renderer stays webgl2 (Ruken has no WebGPU value, R-8); the models come in through the preload.
    expect(render3dExtension.manifest).toBeUndefined()
  })

  it('camera-view is a folder of views, one file each, sent to the sim (it decides rotate and the entry heading)', () => {
    expect(cameraViewContent).toMatchObject({
      kind: 'camera-view',
      place: { folder: 'camera-views' },
      sim: true,
    })
    expect(cameraViewContent.schema).toBe(cameraViewSchema)
  })

  it('registers the scene-lighting content kind (M3.4d)', () => {
    expect(render3dExtension.content?.map((kind) => kind.kind)).toContain('scene-lighting')
  })

  it('resolves beside other extensions', () => {
    const resolved = resolveExtensions([render3dExtension])
    expect(resolved.order).toEqual(['render-pixi3d'])
    expect(resolved.simPlugins).toEqual([cameraHeadingPlugin])
  })
})

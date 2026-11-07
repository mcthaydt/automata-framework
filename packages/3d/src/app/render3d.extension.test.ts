import { resolveExtensions } from '@automata/framework/extension'
import { describe, expect, it } from 'vitest'
import { cameraViewContent } from '../features/camera/camera-view.content.ts'
import { cameraHeadingPlugin } from '../features/camera/sim/camera-heading.plugin.ts'
import { cameraViewSchema } from '../features/camera/sim/camera-view.schema.ts'
import { sceneLightingContent } from '../shared/render/light/scene-lighting.content.ts'
import { render3dExtension } from './render3d.extension.ts'

describe('render3dExtension', () => {
  it('is the @automata/3d extension, bringing the camera’s heading to the sim and camera-view to the content', () => {
    expect(render3dExtension.name).toBe('3d')
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
    expect(resolved.order).toEqual(['3d'])
    expect(resolved.simPlugins).toEqual([cameraHeadingPlugin])
  })
})

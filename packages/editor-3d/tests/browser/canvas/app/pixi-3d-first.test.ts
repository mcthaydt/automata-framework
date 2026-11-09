import { autoDetectRenderer, Container, Sprite, Texture } from 'pixi.js'
import { afterEach, describe, expect, it } from 'vitest'
import { loadPixi3dFirst } from '#src/app/suite/pixi-3d-first.ts'

// The page with every editor lets a visitor open them in any order. Pixi 3D's beta refuses to load once another Pixi canvas
// has made its own textures, which showed as "Preview unavailable" on a 2D level and "needs WebGL2" on the Studio after Levels 3D
// had drawn. Loading it first, as `main.ts` does, makes every order work. This file is its own browser module graph, so
// nothing here has loaded Pixi 3D before the test says so.

const canvases: HTMLCanvasElement[] = []
afterEach(() => {
  for (const canvas of canvases.splice(0)) canvas.remove()
})

function add(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  document.body.append(canvas)
  canvases.push(canvas)
  return canvas
}

describe('Pixi 3D loaded first', () => {
  it('lets the Studio stage start after a plain Pixi canvas has drawn a picture of its own', async () => {
    await loadPixi3dFirst()

    // What Levels 3D's plan or a 2D level does: a renderer, and a texture of its own.
    const plain = await autoDetectRenderer({
      canvas: add(),
      width: 64,
      height: 64,
      preference: ['webgl'],
      preferWebGLVersion: 2,
    })
    const picture = document.createElement('canvas')
    picture.width = picture.height = 4
    const stage = new Container()
    stage.addChild(new Sprite(Texture.from(picture)))
    plain.render(stage)

    const { createStageRenderer } = await import('#src/features/studio/stage/stage-renderer.ts')
    const made = await createStageRenderer(add(), { w: 64, h: 64, resolution: 1 }, 0x202228)
    expect(made, 'the Studio stage should have WebGL2 after another editor drew').toBeDefined()
    made?.destroy()
    plain.destroy()
  })
})

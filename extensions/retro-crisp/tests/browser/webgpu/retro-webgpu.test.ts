// The retro grade through Pixi's WebGPU renderer. No test drew its WGSL before: a compile error neither throws nor reaches
// `uncapturederror` (the pass's pipeline is invalid and the frame goes black), so the case reads the shader modules' own compile messages
// (`watchShaderCompile`) and then checks the grade moved the picture and the snap put what the scene drew back on the palette, as the
// WebGL2 case beside it does. A machine with no WebGPU adapter (Pixi falls back to WebGL) cannot judge this: the case returns early.
//
// The look's registry is the page's, so the pass is added once, after the frame shown without it.
import '@automata/3d/no-eval'
import { createPixi3dRenderer, DEFAULT_LOOK, type Pixi3dRenderer } from '@automata/3d'
import { watchShaderCompile } from '@automata/3d/testing-checks'
import { DEFAULT_PALETTE } from '@automata/content/palette'
import { CubeGeometry, FlatMaterial, Mesh3D } from '@pixi/3d'
import { afterEach, describe, expect, it } from 'vitest'
import { addRetroPass } from '#src/app/add-retro.ts'
import { RetroEffect } from '#src/features/retro/retro-effect.ts'
import { colourAt, DUEL, drawn, SIZE, SKY, target } from '../pass/support.ts'

const frame = { alpha: 1, frameMs: 16, paused: false }
const PLAIN = Number.parseInt((DEFAULT_PALETTE.colors[20] as string).slice(1), 16)

let open: { dispose(): void } | undefined
afterEach(() => {
  open?.dispose()
  open = undefined
  document.body.replaceChildren()
})

async function start(): Promise<Pixi3dRenderer> {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const made = await createPixi3dRenderer({
    preference: 'webgpu',
    logicalWidth: SIZE.width,
    logicalHeight: SIZE.height,
    backgroundColor: SKY,
    views: {},
    look: DEFAULT_LOOK,
    scene: (view) => {
      view.camera.position.set(0, 1, 5)
      view.camera.lookAt({ x: 0, y: 1, z: 0 })
      const cube = new Mesh3D({
        geometry: new CubeGeometry(),
        material: new FlatMaterial({ baseColor: PLAIN }),
      })
      cube.position.set(0, 1, 0)
      cube.scale.set(1.5, 1.5, 1.5)
      view.root.addChild(cube)
      return undefined
    },
  })(target(host))
  if (!made.ok) throw made.reason
  open = made.value
  return made.value
}

const onWebGpu = (renderer: Pixi3dRenderer): boolean =>
  (renderer.stage.app.renderer as unknown as { name: string }).name === 'webgpu'

/** The canvas as the last draw left it, top row first: a WebGPU canvas is copied to a 2D one in the task that drew it. */
function pixelsOf(renderer: Pixi3dRenderer): Uint8Array {
  const { canvas } = renderer.stage.app
  const copy = document.createElement('canvas')
  copy.width = canvas.width
  copy.height = canvas.height
  const g = copy.getContext('2d', { willReadFrequently: true })
  if (g === null) throw new Error('no 2D context')
  g.drawImage(canvas as unknown as CanvasImageSource, 0, 0)
  return new Uint8Array(g.getImageData(0, 0, copy.width, copy.height).data.buffer)
}

function shot(renderer: Pixi3dRenderer): Uint8Array {
  for (let i = 0; i < 4; i++) renderer.draw(frame)
  return pixelsOf(renderer)
}

describe('the retro grade on WebGPU', () => {
  it('compiles its WGSL, and the clinic profile moves the picture and the snap puts the scene back on the palette', async () => {
    const plain = await start()
    if (!onWebGpu(plain)) return
    const bare = shot(plain)
    open?.dispose()
    document.body.replaceChildren()
    addRetroPass()
    const renderer = await start()
    const retro = renderer.view.passes.find((p) => p instanceof RetroEffect) as RetroEffect
    retro.profile = {}
    const compile = watchShaderCompile(renderer.stage.app.renderer)
    const graded = shot(renderer)
    expect(await compile.settle()).toEqual([])
    const moved = drawn(bare, graded)
    expect(moved.length).toBeGreaterThan(200)
    const content = moved.filter((i) => colourAt(bare, i) !== 0 && colourAt(bare, i) !== SKY)
    expect(content.length).toBeGreaterThan(100)
    expect(content.every((i) => DUEL.has(colourAt(graded, i)))).toBe(true)
  }, 60_000)
})

import { createSim, defineComponent, definePlugin, type Sim } from '@mcthaydt/automata-sim'
import { Application, RenderTexture } from 'pixi.js'
import { afterEach, describe, expect, it } from 'vitest'
import { createDrawLayer } from '#src/app/draw/draw-layer.ts'

// The draw layer on a real WebGL2 renderer in Chromium, WebKit and Firefox (PRODUCT.2 step 4): a rect lands on
// exactly its logical pixels, and text draws over the playfield.
const Body = defineComponent('body', { x: 'f32', y: 'f32' })
const plugin = definePlugin({ name: 'drawn', defs: [Body] })

describe('draw layer browser parity', () => {
  let app: Application | undefined
  let sim: Sim | undefined

  afterEach(() => {
    app?.destroy(true, { children: true })
    app = undefined
    sim?.dispose()
    sim = undefined
  })

  it('draws a rect on its pixels and text at its position', async () => {
    app = new Application()
    await app.init({ preference: 'webgl', width: 64, height: 64, resolution: 1, autoStart: false })
    sim = await createSim({ plugins: [plugin], seed: 1 })
    const layer = createDrawLayer(
      (ctx) => {
        ctx.rect(8, 8, 4, 4, 0xff0000)
        ctx.text('HI', 32, 32, { color: 0x00ff00, size: 16 })
      },
      { width: 64, height: 64 },
    )
    const hooks = layer.setup({ ui: app.stage })
    layer.watch(sim)
    hooks.draw?.({ alpha: 1, frameMs: 16, paused: false })

    const target = RenderTexture.create({ width: 64, height: 64, resolution: 1 })
    app.renderer.render({ container: app.stage, target, clear: true, clearColor: [0, 0, 0, 1] })
    const { pixels, width } = app.renderer.extract.pixels(target)
    const at = (x: number, y: number) => [...pixels.slice((y * width + x) * 4, (y * width + x) * 4 + 3)]

    const redColumns = new Set<number>()
    const redRows = new Set<number>()
    let greenOutside = 0
    let greenInside = 0
    for (let y = 0; y < 64; y++)
      for (let x = 0; x < 64; x++) {
        const [r = 0, g = 0, b = 0] = at(x, y)
        if (r > 200 && g < 50 && b < 50) {
          redColumns.add(x)
          redRows.add(y)
        }
        if (g > 100 && r < 100) {
          if (x >= 32 && y >= 32) greenInside++
          else greenOutside++
        }
      }
    expect([...redColumns].sort((a, b) => a - b)).toEqual([8, 9, 10, 11])
    expect([...redRows].sort((a, b) => a - b)).toEqual([8, 9, 10, 11])
    expect(greenInside).toBeGreaterThan(0)
    expect(greenOutside).toBe(0)
    target.destroy(true)
  })
})

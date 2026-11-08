import { Application, RenderTexture } from 'pixi.js'
import { afterEach, describe, expect, it } from 'vitest'
import { RenderDeltaConsumer, rect } from '#src/entries/render.ts'

// A real WebGL2 renderer in each browser engine: the rect view's display object must land at the position
// interpolated between two ticks, and the rendered pixels must sit exactly there.
describe('entity views browser parity', () => {
  let app: Application | undefined

  afterEach(() => {
    app?.destroy(true, { children: true })
    app = undefined
  })

  it('draws a rect view at the interpolated position', async () => {
    app = new Application()
    await app.init({ preference: 'webgl', width: 64, height: 64, resolution: 1, autoStart: false })
    const consumer = new RenderDeltaConsumer(app.stage, {
      body: rect({ w: 4, h: 4, color: 0xff0000, anchor: 0 }),
    })

    consumer.apply({
      resync: true,
      added: [{ sid: 1, components: { body: { x: 8, y: 8 } } }],
      changed: [],
      removed: [],
    })
    consumer.apply({
      resync: false,
      added: [],
      changed: [{ sid: 1, components: { body: { x: 24, y: 8 } } }],
      removed: [],
    })
    consumer.interpolate(0.5)

    const view = app.stage.children[0]
    if (!view) throw new Error('no view mounted')
    const at = view.getGlobalPosition()
    expect([at.x, at.y]).toEqual([16, 8])

    const target = RenderTexture.create({ width: 64, height: 64, resolution: 1 })
    app.renderer.render({ container: app.stage, target, clear: true, clearColor: [0, 0, 0, 1] })
    const { pixels, width } = app.renderer.extract.pixels(target)

    const redColumns: number[] = []
    const redRows = new Set<number>()
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const i = (y * width + x) * 4
        if ((pixels[i] ?? 0) > 200 && (pixels[i + 1] ?? 0) < 50) {
          if (!redColumns.includes(x)) redColumns.push(x)
          redRows.add(y)
        }
      }
    }
    expect(redColumns.sort((a, b) => a - b)).toEqual([16, 17, 18, 19])
    expect([...redRows].sort((a, b) => a - b)).toEqual([8, 9, 10, 11])
    target.destroy(true)
  })
})

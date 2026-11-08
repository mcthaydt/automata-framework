// Words on the hud survive Try again (spec D2, plan task 7): a rebuild makes a new Pixi app, so the hud and its pooled
// labels are new too. A word set on the new hud must draw, not stay on the app that was thrown away.
import '#src/entries/no-eval.ts'
import { createHudText, type HudText } from '@automata/framework'
import { fakeClock } from '@automata/framework/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { createPixi3dRenderer } from '#src/app/create-renderer.ts'
import { CONTEXT_RESTORE_MS } from '#src/features/renderer/context-loss.ts'
import { builtRenderer } from '#src/testing/built-renderer.ts'
import { snapshot } from '#src/testing/snapshot.ts'
import { testTarget } from '#src/testing/test-target.ts'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null
const frame = { alpha: 1, frameMs: 16, paused: false }
const STYLE = { size: 10, floor: 14, color: 0xffffff, shadow: true } as const

/** How many pixels are close to white: the word's fill, on the dark sky. */
function whitePixels(pixels: ArrayLike<number>): number {
  let count = 0
  for (let i = 0; i < pixels.length; i += 4)
    if ((pixels[i] ?? 0) > 200 && (pixels[i + 1] ?? 0) > 200 && (pixels[i + 2] ?? 0) > 200) count++
  return count
}

let scope: { dispose(): void } | undefined
afterEach(() => {
  scope?.dispose()
  scope = undefined
  document.body.replaceChildren()
})

describe.runIf(hasWebGL2)('a word on the hud after Try again', () => {
  it('draws on the new app as it did on the old one', async () => {
    const clock = fakeClock()
    const host = document.createElement('div')
    document.body.appendChild(host)
    const target = testTarget(host, {})
    // setup runs once per app, so this is the hud text of the app that is live now.
    let hud: HudText | undefined
    const renderer = await builtRenderer(
      createPixi3dRenderer({
        logicalWidth: 160,
        logicalHeight: 90,
        backgroundColor: 0x2e222f,
        views: {},
        clock,
        setup: (stage) => {
          hud = createHudText(stage)
          return undefined
        },
      })(target),
    )
    scope = renderer

    const say = async (): Promise<number> => {
      await hud?.ready
      hud?.label().set('Ouch, a wall!', 80, 45, { ...STYLE, anchor: { x: 0.5, y: 0.5 } })
      renderer.draw(frame)
      return whitePixels(snapshot(renderer))
    }
    expect(await say()).toBeGreaterThan(50)

    const oldCanvas = renderer.stage.app.canvas
    const gl = (renderer.stage.app.renderer as unknown as { gl: WebGL2RenderingContext }).gl
    const lost = new Promise<void>((r) =>
      oldCanvas.addEventListener('webglcontextlost', () => r(), { once: true }),
    )
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    await lost
    clock.advance(CONTEXT_RESTORE_MS)
    await expect.poll(() => target.lostPanels.length).toBe(1)
    target.lostPanels[0]?.()
    await expect
      .poll(() => renderer.stage.app.canvas !== oldCanvas && oldCanvas.isConnected === false)
      .toBe(true)

    expect(await say()).toBeGreaterThan(50)
  })
})

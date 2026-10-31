import { afterEach, describe, expect, it } from 'vitest'
import { readStudioContent } from '../studio-content'
import { DEFAULT_ORBIT } from './stage-camera'
import { createStageRenderer, type StageRenderer } from './stage-renderer'

// The Studio stage's renderer (EDS.9a) in a real browser with WebGL2: Wick is drawn by the game's own figure view, a
// turn of the orbit or of his facing changes the picture, a clip's time changes his pose, and a lost context pauses it.

let stage: StageRenderer | undefined
let canvas: HTMLCanvasElement
afterEach(() => {
  stage?.destroy()
  stage = undefined
  canvas?.remove()
})

const BACKGROUND = 0x202228
const SIZE = { w: 200, h: 240, resolution: 1 }
// The recorded fixture game, as Vite hands its files to a browser test.
const raw = import.meta.glob('../../../testing/fixtures/studio/content/**/*.toml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>
const content = readStudioContent(
  Object.entries(raw).map(([path, text]) => ({ path: path.replace(/^.*\/studio\//, ''), text })),
)
const wick = content.figures[0]?.value

async function drawn(): Promise<StageRenderer> {
  canvas = document.createElement('canvas')
  document.body.append(canvas)
  const created = await createStageRenderer(canvas, SIZE, BACKGROUND)
  if (created === undefined) throw new Error('the browser should have WebGL2')
  stage = created
  stage.show(wick, content.library, content.motion)
  stage.look(DEFAULT_ORBIT)
  return stage
}

/** The canvas's pixels, read in the same task as the draw (the drawing buffer is not preserved). */
function pixels(): Uint8ClampedArray {
  const copy = new OffscreenCanvas(canvas.width, canvas.height)
  const context = copy.getContext('2d')
  if (context === null) throw new Error('no 2D context')
  context.drawImage(canvas, 0, 0)
  return context.getImageData(0, 0, canvas.width, canvas.height).data
}

/** How many pixels are not the background. */
function figurePixels(): number {
  const data = pixels()
  const [r, g, b] = [(BACKGROUND >> 16) & 255, (BACKGROUND >> 8) & 255, BACKGROUND & 255]
  let count = 0
  for (let i = 0; i < data.length; i += 4)
    if (
      Math.abs((data[i] ?? 0) - r) + Math.abs((data[i + 1] ?? 0) - g) + Math.abs((data[i + 2] ?? 0) - b) >
      12
    )
      count++
  return count
}

describe('createStageRenderer', () => {
  it('draws Wick: a body of pixels in the middle of the stage, and nothing at a corner', async () => {
    const view = await drawn()
    view.pose({ moving: false }, 0)
    expect(figurePixels()).toBeGreaterThan(1500)
    const data = pixels()
    expect([data[0], data[1], data[2]]).toEqual([
      (BACKGROUND >> 16) & 255,
      (BACKGROUND >> 8) & 255,
      BACKGROUND & 255,
    ])
  })

  it('shows a different picture from the side, and clears when no figure is shown', async () => {
    const view = await drawn()
    view.pose({ moving: false }, 0)
    const front = Array.from(pixels())
    view.look({ ...DEFAULT_ORBIT, yaw: Math.PI / 2 })
    expect(Array.from(pixels())).not.toEqual(front)
    view.show(undefined, content.library, content.motion)
    expect(figurePixels()).toBe(0)
  })

  it('poses him from a clip: the roll at its middle is not the standing figure', async () => {
    const view = await drawn()
    view.pose({ moving: false }, 0)
    const standing = Array.from(pixels())
    view.pose({ moving: false, action: { id: 'roll', startedAt: 0 } }, 0.2)
    expect(Array.from(pixels())).not.toEqual(standing)
  })

  it('pauses when the context is lost and draws again when it is restored', async () => {
    const view = await drawn()
    let value = false
    view.paused.subscribe((now) => {
      value = now
    })
    const extension = canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')
    extension?.loseContext()
    await expect.poll(() => value).toBe(true)
    extension?.restoreContext()
    await expect.poll(() => value).toBe(false)
  })
})

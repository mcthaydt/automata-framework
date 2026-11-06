import { get } from 'svelte/store'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createColorResolver } from '#src/shared/level-2d/canvas/colors.ts'
import type { LayerDraw, LevelDrawList } from '#src/shared/level-2d/canvas/draw/draw-list-types.ts'
import { createLevelView, fitCamera, type LevelView } from '#src/shared/level-2d/canvas/level-view.ts'
import { createTextureManager } from '#src/shared/level-2d/canvas/textures.manager.ts'
import { cellsPng } from '#src/testing/level-2d/png.ts'

// The editable canvas in Chromium with WebGL2.

const colors = createColorResolver((name) => (name === '--color-bg-canvas' ? '#0a0b0d' : ''))
const textures = createTextureManager({
  read: async (path) => (path === 'assets/blue.png' ? cellsPng(1, 1, 8, ['#0000ff']) : undefined),
})
beforeAll(() => textures.load(['assets/blue.png']))
afterAll(() => textures.destroy())

/** A tiles layer with one 10 px tile cut from the loaded blue image, at the level's top-left. */
const blueTile: LayerDraw = {
  kind: 'tiles',
  def: 't',
  opacity: 1,
  locked: false,
  chunks: [
    {
      cx: 0,
      cy: 0,
      bounds: { x: 0, y: 0, w: 160, h: 160 },
      tiles: [
        {
          x: 0,
          y: 0,
          w: 10,
          h: 10,
          tile: 0,
          flipX: false,
          flipY: false,
          kind: 'image',
          image: 'assets/blue.png',
          frame: { x: 0, y: 0, w: 8, h: 8 },
        },
      ],
    },
  ],
}
let view: LevelView | undefined
let canvas: HTMLCanvasElement

afterEach(() => {
  view?.destroy()
  view = undefined
  canvas?.remove()
})

async function viewOf(width = 40, height = 20): Promise<LevelView> {
  canvas = document.createElement('canvas')
  document.body.append(canvas)
  const created = await createLevelView({ canvas, textures, colors, width, height, resolution: 1 })
  if (created === undefined) throw new Error('Chromium should have WebGL2')
  view = created
  return created
}

const solid = (color: string): LevelDrawList => ({
  level: 'l',
  size: { w: 20, h: 10 },
  background: { color, mode: 'fit' },
  layers: [],
  grid: undefined,
  footprint: undefined,
  selection: [],
  links: [],
})

/** The canvas's colour at a pixel, read in the same task as the render (the drawing buffer is not preserved). */
function colorAt(x: number, y: number): string {
  const copy = new OffscreenCanvas(canvas.width, canvas.height)
  const context = copy.getContext('2d')
  if (context === null) throw new Error('no 2D context')
  context.drawImage(canvas, 0, 0)
  const [r, g, b] = context.getImageData(x, y, 1, 1).data
  const hex = (value: number | undefined) => (value ?? 0).toString(16).padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

/** Resolves once `paused` reads `value` (the context events arrive as tasks). */
function pausedBecomes(target: LevelView, value: boolean): Promise<void> {
  return new Promise((resolve) => {
    const stop = target.paused.subscribe((paused) => {
      if (paused !== value) return
      queueMicrotask(() => stop())
      resolve()
    })
  })
}

describe('fitCamera', () => {
  it('fits a level in a box and centres it', () => {
    expect(fitCamera({ w: 20, h: 10 }, { w: 40, h: 40 })).toEqual({ x: 0, y: 10, scale: 2 })
    expect(fitCamera({ w: 20, h: 10 }, { w: 10, h: 10 })).toEqual({ x: 0, y: 2.5, scale: 0.5 })
  })
})

describe('level view', () => {
  it('draws a list at a camera, on the canvas background outside the level', async () => {
    const level = await viewOf()
    level.render(solid('#336699'), { x: 10, y: 5, scale: 1 })
    expect(colorAt(15, 10)).toBe('#336699')
    expect(colorAt(2, 2)).toBe('#0a0b0d')
    level.render(solid('#336699'), fitCamera({ w: 20, h: 10 }, { w: 40, h: 20 }))
    expect(colorAt(2, 2)).toBe('#336699')
  })

  it('pauses on a lost context, keeps the latest list, and draws it once the context is back', async () => {
    const level = await viewOf()
    const camera = fitCamera({ w: 20, h: 10 }, { w: 40, h: 20 })
    level.render(solid('#336699'), camera)
    expect(get(level.paused)).toBe(false)
    const gl = canvas.getContext('webgl2')
    const lose = gl?.getExtension('WEBGL_lose_context')
    if (lose === undefined || lose === null) throw new Error('Chromium has WEBGL_lose_context')
    const paused = pausedBecomes(level, true)
    lose.loseContext()
    await paused
    // Drawing while paused does nothing on the GPU and does not throw; the list is kept.
    expect(() => level.render({ ...solid('#993366'), layers: [blueTile] }, camera)).not.toThrow()
    const resumed = pausedBecomes(level, false)
    // A restore asked for while the loss event is still being delivered never arrives in Chromium; ask in a later task.
    await new Promise((resolve) => setTimeout(resolve, 0))
    lose.restoreContext()
    await resumed
    // The background, and the tile sprite whose texture Pixi uploads again to the new context.
    expect(colorAt(30, 10)).toBe('#993366')
    expect(colorAt(5, 5)).toBe('#0000ff')
  })

  it('resizes the canvas without drawing, so the caller draws once at the new size', async () => {
    const level = await viewOf()
    level.render(solid('#336699'), { x: 0, y: 0, scale: 1 })
    level.resize(80, 30, 1)
    expect(canvas.width).toBe(80)
    expect(canvas.height).toBe(30)
    // A resized drawing buffer is cleared, and nothing was drawn into it yet.
    expect(colorAt(5, 5)).toBe('#000000')
    level.render(solid('#336699'), { x: 0, y: 0, scale: 1 })
    expect(colorAt(5, 5)).toBe('#336699')
  })

  it('lets go of the renderer and stops listening when destroyed', async () => {
    const level = await viewOf()
    level.render(solid('#336699'), { x: 0, y: 0, scale: 1 })
    level.destroy()
    view = undefined
    expect(() => level.render(solid('#993366'), { x: 0, y: 0, scale: 1 })).not.toThrow()
    expect(get(level.paused)).toBe(false)
  })

  it('refuses a canvas that can only give WebGL 1 (WebGL2 is the floor)', async () => {
    canvas = document.createElement('canvas')
    // A canvas that already has a WebGL 1 context cannot give a WebGL2 one.
    canvas.getContext('webgl')
    const created = await createLevelView({ canvas, textures, colors, width: 10, height: 10, resolution: 1 })
    expect(created).toBeUndefined()
  })

  it('answers undefined when the page has no WebGL', async () => {
    canvas = document.createElement('canvas')
    // A canvas that already has a 2D context cannot give a WebGL one.
    canvas.getContext('2d')
    const created = await createLevelView({ canvas, textures, colors, width: 10, height: 10, resolution: 1 })
    expect(created).toBeUndefined()
  })
})

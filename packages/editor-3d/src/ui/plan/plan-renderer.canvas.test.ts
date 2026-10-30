import { get } from 'svelte/store'
import { afterEach, describe, expect, it } from 'vitest'
import { PLAN_COLORS } from '../../view/plan/plan-colors'
import type { PlanPaint } from '../../view/plan/plan-paint'
import { createPlanRenderer, type PlanRenderer } from './plan-renderer'

// The Plan view's renderer (plan ED3D.5d step 3) in Chromium with WebGL2: what a paint list puts on the canvas, read
// back as pixels, and what a resize and a lost context do.

let renderer: PlanRenderer | undefined
let canvas: HTMLCanvasElement

afterEach(() => {
  renderer?.destroy()
  renderer = undefined
  canvas?.remove()
})

async function rendererOf(w = 60, h = 40): Promise<PlanRenderer> {
  canvas = document.createElement('canvas')
  document.body.append(canvas)
  const created = await createPlanRenderer(canvas, { w, h, resolution: 1 })
  if (created === undefined) throw new Error('Chromium should have WebGL2')
  renderer = created
  return created
}

const EMPTY: PlanPaint = {
  background: PLAN_COLORS.background,
  grid: [],
  fills: [],
  walls: [],
  links: [],
  things: [],
  rulers: { x: [], z: [] },
}

const hall = {
  sector: 'hall',
  points: [10, 10, 30, 10, 30, 30, 10, 30],
  holes: [],
  color: 0x336699,
  selected: false,
}

/** A 20×20 square fill at (10, 10), a solid wall along its top and a lamp disc at (50, 30). */
const square: PlanPaint = {
  ...EMPTY,
  fills: [hall],
  walls: [{ a: { x: 10, y: 10 }, b: { x: 30, y: 10 }, color: 0xff0000, width: 4, dashed: false }],
  things: [{ id: 'l1', shape: 'disc', x: 50, y: 30, color: 0x00ff00, selected: false }],
}

const hex = (value: number): string => `#${value.toString(16).padStart(6, '0')}`

/** The canvas's colour at a pixel, read in the same task as the draw (the drawing buffer is not preserved). */
function colorAt(x: number, y: number): string {
  const copy = new OffscreenCanvas(canvas.width, canvas.height)
  const context = copy.getContext('2d')
  if (context === null) throw new Error('no 2D context')
  context.drawImage(canvas, 0, 0)
  const [r = 0, g = 0, b = 0] = context.getImageData(x, y, 1, 1).data
  return hex((r << 16) | (g << 8) | b)
}

const pausedBecomes = (view: PlanRenderer, value: boolean): Promise<void> =>
  new Promise((resolve) => {
    const stop = view.paused.subscribe((now) => {
      if (now !== value) return
      queueMicrotask(() => stop())
      resolve()
    })
  })

describe('createPlanRenderer', () => {
  it('paints the background, a fill, a wall and a thing where the paint list puts them', async () => {
    const view = await rendererOf()
    view.draw(square)
    expect(colorAt(2, 2)).toBe(hex(PLAN_COLORS.background))
    expect(colorAt(20, 22)).toBe('#336699')
    expect(colorAt(20, 10)).toBe('#ff0000')
    expect(colorAt(50, 30)).toBe('#00ff00')
  })

  it('cuts a sector’s hole out of its fill', async () => {
    const view = await rendererOf()
    view.draw({ ...EMPTY, fills: [{ ...hall, holes: [[15, 15, 25, 15, 25, 25, 15, 25]] }] })
    expect(colorAt(20, 20)).toBe(hex(PLAN_COLORS.background))
    expect(colorAt(12, 20)).toBe('#336699')
  })

  it('resizes the drawing buffer and draws the last list again at the new size', async () => {
    const view = await rendererOf()
    view.draw(square)
    view.resize({ w: 90, h: 50, resolution: 1 })
    expect(canvas.width).toBe(90)
    expect(canvas.height).toBe(50)
    expect(colorAt(20, 22)).toBe('#336699')
  })

  it('refuses a canvas that can only give WebGL 1, and one with no WebGL', async () => {
    canvas = document.createElement('canvas')
    canvas.getContext('webgl')
    expect(await createPlanRenderer(canvas, { w: 10, h: 10, resolution: 1 })).toBeUndefined()
    canvas = document.createElement('canvas')
    canvas.getContext('2d')
    expect(await createPlanRenderer(canvas, { w: 10, h: 10, resolution: 1 })).toBeUndefined()
  })

  it('pauses while the context is lost, keeps the newest list, and draws it when the context is back', async () => {
    const view = await rendererOf()
    view.draw(EMPTY)
    const lose = (canvas.getContext('webgl2') as WebGL2RenderingContext).getExtension('WEBGL_lose_context')
    if (lose === null) throw new Error('Chromium has WEBGL_lose_context')
    const paused = pausedBecomes(view, true)
    lose.loseContext()
    await paused
    expect(get(view.paused)).toBe(true)
    expect(() => view.draw(square)).not.toThrow()
    const resumed = pausedBecomes(view, false)
    // A restore asked for while the loss event is still being delivered never arrives in Chromium (editor-2d's finding).
    await new Promise((resolve) => setTimeout(resolve, 0))
    lose.restoreContext()
    await resumed
    expect(colorAt(20, 22)).toBe('#336699')
  })
})

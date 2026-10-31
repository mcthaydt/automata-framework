import { afterEach, describe, expect, it } from 'vitest'
import type { WorldRect } from '../app/world/world-model'
import { createColorResolver } from './colors'
import { createWorldView, type WorldView } from './world-view'

// The World view's map (plan ED2D.6b step 4) in Chromium with WebGL2: a rectangle per level on the canvas background,
// the selected one outlined in the accent.

const TOKENS: Readonly<Record<string, string>> = {
  '--color-bg-canvas': '#0a0b0d',
  '--color-bg-field': '#202428',
  '--color-border-strong': '#505860',
  '--color-accent-default': '#e8a33d',
  '--color-text-primary': '#f0f0f0',
}
const colors = createColorResolver((name) => TOKENS[name] ?? '')

let view: WorldView | undefined
let canvas: HTMLCanvasElement
afterEach(() => {
  view?.destroy()
  view = undefined
  canvas?.remove()
})

async function viewOf(width = 200, height = 100): Promise<WorldView> {
  canvas = document.createElement('canvas')
  document.body.append(canvas)
  const created = await createWorldView({ canvas, colors, width, height, resolution: 1 })
  if (created === undefined) throw new Error('Chromium should have WebGL2')
  view = created
  return created
}

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

const rect = (id: string, x: number, selected: boolean): WorldRect => ({
  id,
  name: '',
  x,
  y: 0,
  w: 80,
  h: 60,
  depth: 0,
  selected,
})

describe('world view', () => {
  it('draws each level as a rectangle at the camera, the selected one outlined, on the canvas background', async () => {
    const world = await viewOf()
    world.render([rect('a', 0, false), rect('b', 100, true)], { x: 10, y: 20, scale: 1 })
    expect(colorAt(50, 50)).toBe('#202428')
    expect(colorAt(150, 50)).toBe('#202428')
    expect(colorAt(5, 5)).toBe('#0a0b0d')
    expect(colorAt(95, 50)).toBe('#0a0b0d')
    // The selected level's left edge is the accent; the other's is the border.
    expect(colorAt(111, 50)).toBe('#e8a33d')
    expect(colorAt(10, 50)).toBe('#505860')
  })

  it('follows the camera', async () => {
    const world = await viewOf()
    world.render([rect('a', 0, false)], { x: 0, y: 0, scale: 0.5 })
    expect(colorAt(20, 15)).toBe('#202428')
    expect(colorAt(60, 15)).toBe('#0a0b0d')
  })
})

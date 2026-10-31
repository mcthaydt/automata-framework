import { afterEach, describe, expect, it } from 'vitest'
import type { WorldLink } from '../app/world/world-links'
import type { WorldRect } from '../app/world/world-model'
import { createColorResolver } from './colors'
import type { LevelDrawList } from './draw/draw-list-types'
import { createTextureManager } from './textures.manager'
import { createWorldView, type WorldView } from './world-view'

// The World view's map (plan ED2D.6b step 4) in Chromium with WebGL2: a rectangle per level on the canvas background,
// the selected one outlined in the accent.

const TOKENS: Readonly<Record<string, string>> = {
  '--color-bg-canvas': '#0a0b0d',
  '--color-bg-field': '#202428',
  '--color-border-strong': '#505860',
  '--color-accent-default': '#e8a33d',
  '--color-text-primary': '#f0f0f0',
  '--color-bg-surface': '#16191c',
}
const colors = createColorResolver((name) => TOKENS[name] ?? '')

const textures = createTextureManager({ read: async () => undefined })
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
  const created = await createWorldView({ canvas, colors, textures, width, height, resolution: 1 })
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
    world.render([rect('a', 0, false), rect('b', 100, true)], { x: 10, y: 20, scale: 1 }, [])
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
    world.render([rect('a', 0, false)], { x: 0, y: 0, scale: 0.5 }, [])
    expect(colorAt(20, 15)).toBe('#202428')
    expect(colorAt(60, 15)).toBe('#0a0b0d')
  })

  it('draws a link as a curve in its colour between the facing edges, with an arrowhead (plan ED2D.6c)', async () => {
    const world = await viewOf()
    const link: WorldLink = {
      from: 'a',
      to: 'b',
      label: 'Door',
      color: '#ff0000',
      start: { x: 80, y: 30 },
      control: { x: 90, y: 30 },
      end: { x: 100, y: 30 },
      middle: { x: 90, y: 30 },
    }
    world.render([rect('a', 0, false), rect('b', 100, false)], { x: 10, y: 20, scale: 1 }, [link])
    // Halfway along the gap between the levels, on the canvas background.
    expect(colorAt(95, 50)).toBe('#ff0000')
    world.render([rect('a', 0, false), rect('b', 100, false)], { x: 10, y: 20, scale: 1 }, [])
    expect(colorAt(95, 50)).toBe('#0a0b0d')
  })

  it('draws each level inside its rectangle, with the outline over the picture (plan ED2D.8b)', async () => {
    const world = await viewOf()
    const picture: LevelDrawList = {
      level: 'b',
      size: { w: 80, h: 60 },
      background: { color: '#ff0000', mode: 'fit' },
      layers: [],
      grid: undefined,
      footprint: undefined,
      selection: [],
      links: [],
    }
    world.render(
      [rect('a', 0, false), rect('b', 100, true)],
      { x: 10, y: 20, scale: 1 },
      [],
      new Map([['b', picture]]),
    )
    // Inside b: its level's background; inside a (no picture): the plain fill; b's left edge: still the accent.
    expect(colorAt(150, 50)).toBe('#ff0000')
    expect(colorAt(50, 50)).toBe('#202428')
    expect(colorAt(111, 50)).toBe('#e8a33d')
    world.render([rect('a', 0, false), rect('b', 100, true)], { x: 10, y: 20, scale: 1 }, [], new Map())
    expect(colorAt(150, 50)).toBe('#202428')
  })

  it('puts each name on a plate over the picture, so a busy picture cannot swallow it (plan ED2D.8c)', async () => {
    const world = await viewOf()
    const picture: LevelDrawList = {
      level: 'b',
      size: { w: 80, h: 60 },
      background: { color: '#ff0000', mode: 'fit' },
      layers: [],
      grid: undefined,
      footprint: undefined,
      selection: [],
      links: [],
    }
    world.render(
      [{ ...rect('b', 100, false), name: 'Village' }],
      { x: 10, y: 20, scale: 1 },
      [],
      new Map([['b', picture]]),
    )
    // b's top-left corner is at (110, 20); the plate starts 6 px in, and its left padding has no glyph.
    expect(colorAt(117, 30)).toBe('#16191c')
    // Below the plate: the picture.
    expect(colorAt(117, 70)).toBe('#ff0000')
  })
})

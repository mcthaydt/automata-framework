import { get } from 'svelte/store'
import { afterEach, describe, expect, it } from 'vitest'
import type { DollhousePaint } from '#src/features/levels-3d/dollhouse/dollhouse-paint.ts'
import {
  createDollhouseRenderer,
  type DollhouseRenderer,
} from '#src/features/levels-3d/dollhouse/dollhouse-renderer.ts'
import { PLAN_COLORS } from '#src/features/levels-3d/plan/plan-colors.ts'

// The dollhouse renderer (plan ED3D.5e step 4) in Chromium with WebGL2: a paint list's triangles in their colours, the
// later over the earlier, the selection outlined in the accent, and what a lost context does.

let renderer: DollhouseRenderer | undefined
let canvas: HTMLCanvasElement

afterEach(() => {
  renderer?.destroy()
  renderer = undefined
  canvas?.remove()
})

async function rendererOf(w = 100, h = 80): Promise<DollhouseRenderer> {
  canvas = document.createElement('canvas')
  document.body.append(canvas)
  const created = await createDollhouseRenderer(canvas, { w, h, resolution: 1 })
  if (created === undefined) throw new Error('Chromium should have WebGL2')
  renderer = created
  return created
}

const hex = (value: number): string => `#${value.toString(16).padStart(6, '0')}`

function colorAt(x: number, y: number): string {
  const copy = new OffscreenCanvas(canvas.width, canvas.height)
  const context = copy.getContext('2d')
  if (context === null) throw new Error('no 2D context')
  context.drawImage(canvas, 0, 0)
  const [r, g, b] = context.getImageData(x, y, 1, 1).data
  return hex(((r ?? 0) << 16) | ((g ?? 0) << 8) | (b ?? 0))
}

const triangle = (points: number[], color: number, selected = false) => ({
  points,
  edges: [points[0] ?? 0, points[1] ?? 0, points[2] ?? 0, points[3] ?? 0],
  color,
  alpha: 1,
  role: 'wall' as const,
  selection: 'wall:a/0',
  selected,
  depth: 1,
})

const paintOf = (...polygons: ReturnType<typeof triangle>[]): DollhousePaint => ({
  background: PLAN_COLORS.background,
  accent: PLAN_COLORS.accent,
  polygons,
})

describe('dollhouse renderer', () => {
  it('fills each triangle in its colour, a later one over an earlier one, on the background', async () => {
    const view = await rendererOf()
    view.draw(paintOf(triangle([0, 0, 80, 0, 0, 80], 0xff0000), triangle([20, 0, 80, 0, 20, 60], 0x00ff00)))
    expect(colorAt(5, 5)).toBe('#ff0000')
    expect(colorAt(40, 10)).toBe('#00ff00')
    expect(colorAt(95, 75)).toBe(hex(PLAN_COLORS.background))
  })

  it('outlines a selected triangle in the accent and tints it', async () => {
    const view = await rendererOf()
    view.draw(paintOf(triangle([10, 10, 90, 10, 10, 70], 0x000080, true)))
    expect(colorAt(50, 10)).toBe(hex(PLAN_COLORS.accent))
    expect(colorAt(25, 25)).not.toBe('#000080')
  })

  it('pauses while the context is lost and draws again when it is back', async () => {
    const view = await rendererOf()
    view.draw(paintOf(triangle([0, 0, 80, 0, 0, 80], 0xff0000)))
    const lose = (canvas.getContext('webgl2') as WebGL2RenderingContext).getExtension('WEBGL_lose_context')
    if (lose === null) throw new Error('Chromium has WEBGL_lose_context')
    const lost = new Promise<void>((resolve) => view.paused.subscribe((value) => value && resolve()))
    lose.loseContext()
    await lost
    expect(get(view.paused)).toBe(true)
    const back = new Promise<void>((resolve) => view.paused.subscribe((value) => !value && resolve()))
    await new Promise((resolve) => setTimeout(resolve, 0))
    lose.restoreContext()
    await back
    expect(colorAt(5, 5)).toBe('#ff0000')
  })
})

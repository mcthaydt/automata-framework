// Pixi 3D checks, as it loads, that no Pixi texture has been made yet (its own are the first ones), and the plan's renderer is
// the first the editor makes: so it comes in before any renderer is, here, whichever view is shown first. The 3D view and
// Walk draw with it (`dollhouse/game-view.ts`).
import '@automata/3d/no-eval'
import type { Point as ScreenPoint } from '@automata/editor/kit/core'
import {
  type AutoDetectOptions,
  autoDetectRenderer,
  Container,
  Graphics,
  type Renderer,
  type WebGLRenderer,
} from 'pixi.js'
import { type Readable, writable } from 'svelte/store'
import type { PaintStroke, PlanPaint } from './plan-paint'
import type { ToolPaint } from './tool-paint'

// The Plan view's renderer (ED3D.5d, ED3D spec §6): a WebGL2 Pixi renderer on the page's canvas that strokes and fills
// a `PlanPaint` in one `Graphics`, in canvas pixels. Every decision about what is drawn and in what colour was made by
// `planPaint`; this file only puts it on the GPU. Losing the WebGL context is not an error: the renderer says it is
// paused, keeps the newest list, and draws it again on `webglcontextrestored` (ED3D spec §11: the level is untouched).

export interface RendererSize {
  /** CSS pixels, and device pixels per CSS pixel. */
  readonly w: number
  readonly h: number
  readonly resolution: number
}

/** The loupe (ED3D.6g-b): its own paint lists for a camera of its own, drawn as a round lens of `size` at (x, y). */
export interface LoupeDraw {
  readonly paint: PlanPaint
  readonly tool: ToolPaint | undefined
  readonly x: number
  readonly y: number
  readonly size: number
}

export interface PlanRenderer {
  /** True from `webglcontextlost` until `webglcontextrestored`. */
  readonly paused: Readable<boolean>
  /** Draws `paint`, the active tool's overlay and the loupe over it, now, or keeps them for when the context is back. */
  draw(paint: PlanPaint, tool?: ToolPaint, loupe?: LoupeDraw): void
  /** Resizes the drawing buffer and draws the newest list again. */
  resize(size: RendererSize): void
  /** Releases the renderer; later calls do nothing. Leaves the canvas element alone. */
  destroy(): void
}

/** Makes the renderer for a canvas; `undefined` when the page cannot give it WebGL2. The DOM tests pass a fake. */
export type PlanRendererFactory = (
  canvas: HTMLCanvasElement,
  size: RendererSize,
) => Promise<PlanRenderer | undefined>

/**
 * A Pixi renderer on WebGL2, or `undefined` (AGENTS.md: WebGL2 is the default; editor-2d's level view keeps the same
 * rule). Pixi is asked for WebGL only, preferring version 2, and a renderer that came up on WebGL 1 anyway is refused.
 */
export async function createWebGL2Renderer(
  options: Partial<AutoDetectOptions>,
): Promise<Renderer | undefined> {
  let renderer: Renderer
  try {
    renderer = await autoDetectRenderer({ ...options, preference: ['webgl'], preferWebGLVersion: 2 })
  } catch {
    return undefined
  }
  if (renderer.name === 'webgl' && (renderer as WebGLRenderer).context.webGLVersion === 2) return renderer
  renderer.destroy({ removeView: false })
  return undefined
}

const DASH = 6
const GAP = 4

/** A dashed stroke as its dashes: Pixi's `Graphics` has no dash pattern. */
function dashes(a: ScreenPoint, b: ScreenPoint): (readonly [ScreenPoint, ScreenPoint])[] {
  const length = Math.hypot(b.x - a.x, b.y - a.y)
  if (length === 0) return []
  const at = (distance: number): ScreenPoint => ({
    x: a.x + ((b.x - a.x) * distance) / length,
    y: a.y + ((b.y - a.y) * distance) / length,
  })
  const pieces: (readonly [ScreenPoint, ScreenPoint])[] = []
  for (let start = 0; start < length; start += DASH + GAP)
    pieces.push([at(start), at(Math.min(length, start + DASH))])
  return pieces
}

function stroke(graphics: Graphics, line: PaintStroke): void {
  const pieces = line.dashed ? dashes(line.a, line.b) : [[line.a, line.b] as const]
  for (const [from, to] of pieces) graphics.moveTo(from.x, from.y).lineTo(to.x, to.y)
  graphics.stroke({ color: line.color, width: line.width, cap: 'round', join: 'round' })
}

/** The whole list, back to front: grid, fills, walls, links, things. */
function paintInto(graphics: Graphics, paint: PlanPaint): void {
  graphics.clear()
  for (const line of paint.grid) {
    graphics.moveTo(line.a.x, line.a.y).lineTo(line.b.x, line.b.y)
    graphics.stroke({ color: paint.gridColor, alpha: line.major ? 0.09 : 0.045, width: 1 })
  }
  for (const fill of paint.fills) {
    graphics.poly([...fill.points]).fill({ color: fill.color })
    for (const hole of fill.holes) graphics.poly([...hole]).cut()
    if (fill.selected) {
      graphics.poly([...fill.points]).fill({ color: paint.accent, alpha: 0.16 })
      for (const hole of fill.holes) graphics.poly([...hole]).cut()
    }
  }
  for (const line of paint.walls) stroke(graphics, line)
  for (const link of paint.links) {
    graphics.moveTo(link.a.x, link.a.y).lineTo(link.b.x, link.b.y)
    graphics.stroke({ color: link.color, alpha: 0.6, width: 1.5 })
  }
  for (const thing of paint.things) {
    const outline = thing.selected ? { color: paint.accent, width: 2 } : { color: paint.background, width: 1 }
    if (thing.shape === 'disc') {
      graphics.circle(thing.x, thing.y, 5).fill({ color: thing.color }).stroke(outline)
      continue
    }
    graphics
      .rect(thing.x, thing.y, thing.w, thing.h)
      .fill({ color: thing.color, alpha: thing.dashed ? 0.05 : 0.2 })
    if (thing.dashed) {
      const { x, y, w, h } = thing
      const edge = (a: ScreenPoint, b: ScreenPoint): void =>
        stroke(graphics, {
          a,
          b,
          color: thing.selected ? paint.accent : thing.color,
          width: 1.5,
          dashed: true,
        })
      edge({ x, y }, { x: x + w, y })
      edge({ x: x + w, y }, { x: x + w, y: y + h })
      edge({ x: x + w, y: y + h }, { x, y: y + h })
      edge({ x, y: y + h }, { x, y })
    } else {
      graphics
        .rect(thing.x, thing.y, thing.w, thing.h)
        .stroke(thing.selected ? outline : { color: thing.color, width: 1.25 })
    }
  }
}

/** The active tool's overlay, over the plan (ED3D.6g-a): strokes, room outlines, then the dots and rings on top. */
function toolInto(graphics: Graphics, tool: ToolPaint): void {
  for (const line of tool.strokes) stroke(graphics, line)
  for (const outline of tool.outlines)
    graphics.poly([...outline.points]).stroke({ color: outline.color, width: 2, alignment: 0.5 })
  for (const dot of tool.dots) {
    graphics.circle(dot.at.x, dot.at.y, dot.radius)
    if (dot.ring) graphics.stroke({ color: dot.color, width: 2 })
    else graphics.fill({ color: dot.color })
  }
}

export const createPlanRenderer: PlanRendererFactory = async (canvas, size) => {
  const created = await createWebGL2Renderer({
    canvas,
    width: size.w,
    height: size.h,
    resolution: size.resolution,
    antialias: true,
  })
  if (created === undefined) return undefined
  const renderer: Renderer = created
  const graphics = new Graphics()
  // The lens: the plan's background, the lens's paint masked to the circle, and the accent ring over both.
  const lens = new Container()
  const lensBack = new Graphics()
  const lensPicture = new Graphics()
  const lensMask = new Graphics()
  const lensRing = new Graphics()
  lensPicture.mask = lensMask
  lens.addChild(lensBack, lensPicture, lensMask, lensRing)
  const stage = new Container()
  stage.addChild(graphics, lens)
  const paused = writable(false)
  let lost = false
  let destroyed = false
  let latest: PlanPaint | undefined
  let latestTool: ToolPaint | undefined
  let latestLoupe: LoupeDraw | undefined

  function drawLoupe(loupe: LoupeDraw | undefined, background: number, accent: number): void {
    lens.visible = loupe !== undefined
    if (loupe === undefined) return
    const radius = loupe.size / 2
    lens.position.set(loupe.x, loupe.y)
    lensBack.clear().circle(radius, radius, radius).fill({ color: background })
    paintInto(lensPicture, loupe.paint)
    if (loupe.tool !== undefined) toolInto(lensPicture, loupe.tool)
    lensMask.clear().circle(radius, radius, radius).fill({ color: 0xffffff })
    lensRing
      .clear()
      .circle(radius, radius, radius - 1)
      .stroke({ color: accent, width: 3 })
  }

  function render(): void {
    if (lost || destroyed || latest === undefined) return
    renderer.background.color = latest.background
    paintInto(graphics, latest)
    if (latestTool !== undefined) toolInto(graphics, latestTool)
    drawLoupe(latestLoupe, latest.background, latest.accent)
    renderer.render(stage)
  }

  const onLost = (): void => {
    lost = true
    paused.set(true)
  }
  // Pixi's own listener was added first, so its GPU state is made again before this draws.
  const onRestored = (): void => {
    lost = false
    paused.set(false)
    render()
  }
  canvas.addEventListener('webglcontextlost', onLost)
  canvas.addEventListener('webglcontextrestored', onRestored)

  return {
    paused: { subscribe: paused.subscribe },
    draw(paint, tool, loupe) {
      latest = paint
      latestTool = tool
      latestLoupe = loupe
      render()
    },
    resize(next) {
      if (destroyed) return
      renderer.resize(next.w, next.h, next.resolution)
      render()
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
      paused.set(false)
      stage.destroy({ children: true })
      renderer.destroy({ removeView: false })
    },
  }
}

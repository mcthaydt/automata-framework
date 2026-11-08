import { Container, Graphics, type Renderer } from 'pixi.js'
import { type Readable, writable } from 'svelte/store'
import { createWebGL2Renderer, type RendererSize } from '../plan/plan-renderer'
import type { DollhousePaint } from './dollhouse-paint'
import { createGameView, type GameView } from './game-view'

// The Dollhouse view's renderer (ED3D.5e, ED3D-D6: editor-private, flat-shaded, not `@pixi/3d`): a WebGL2 Pixi renderer
// that fills a `DollhousePaint`'s triangles in order (the list is already far to near) in one `Graphics`, each with its
// surface's outline edges, a selected one tinted and outlined in the accent. Losing the context pauses it and keeps the newest list, as the plan's does (ED3D
// spec §11, ED3-p: Plan keeps working; the viewport offers Try again).

export interface DollhouseRenderer {
  readonly paused: Readable<boolean>
  draw(paint: DollhousePaint): void
  resize(size: RendererSize): void
  destroy(): void
}

export type DollhouseRendererFactory = (
  canvas: HTMLCanvasElement,
  size: RendererSize,
) => Promise<DollhouseRenderer | undefined>

/** How much of the accent a selected surface takes on. */
const SELECTED_TINT = 0.35
/** How strongly an unselected surface's outline shows: enough to tell two walls apart. */
const EDGE_ALPHA = 0.6

/** The game draws a field whose short side is this many pixels, upscaled in whole pixels (the look's `pixel.short`). */
const FIELD_SHORT = 180

function paintInto(graphics: Graphics, paint: DollhousePaint): void {
  graphics.clear()
  // Over the game's picture only what is picked is drawn, as a tint and an outline, to show where it is; without a picture
  // every surface is, in its flat colour.
  const game = paint.game !== undefined
  for (const polygon of game ? paint.polygons.filter((each) => each.selected) : paint.polygons) {
    if (!game) graphics.poly([...polygon.points]).fill({ color: polygon.color, alpha: polygon.alpha })
    if (polygon.selected)
      graphics.poly([...polygon.points]).fill({ color: paint.accent, alpha: SELECTED_TINT * polygon.alpha })
    if (polygon.edges.length === 0) continue
    for (let i = 0; i + 3 < polygon.edges.length; i += 4)
      graphics
        .moveTo(polygon.edges[i] as number, polygon.edges[i + 1] as number)
        .lineTo(polygon.edges[i + 2] as number, polygon.edges[i + 3] as number)
    graphics.stroke(
      polygon.selected
        ? { color: paint.accent, width: 2, cap: 'round' }
        : { color: paint.background, width: 1, alpha: EDGE_ALPHA * polygon.alpha, cap: 'round' },
    )
  }
}

export const createDollhouseRenderer: DollhouseRendererFactory = async (canvas, size) => {
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
  const stage = new Container()
  const paused = writable(false)
  let lost = false
  let destroyed = false
  let latest: DollhousePaint | undefined
  /** The game's picture, made when the first paint that has one comes; the blockout needs none. */
  let game: GameView | undefined
  let logical = { w: size.w, h: size.h, resolution: size.resolution }
  let applied = `${size.w}x${size.h}@${size.resolution}`

  /** Sizes the drawing buffer only when it changes: a resize clears it. */
  function sized(resolution: number): void {
    const key = `${logical.w}x${logical.h}@${resolution}`
    if (key === applied) return
    applied = key
    renderer.resize(logical.w, logical.h, resolution)
  }

  /** The picture is the game's pixels: a field of the look's size scaled up whole, so the canvas is drawn at that resolution. */
  function fieldResolution(): number {
    return Math.min(logical.resolution, FIELD_SHORT / Math.max(1, Math.min(logical.w, logical.h)))
  }

  function render(): void {
    if (lost || destroyed || latest === undefined) return
    const frame = latest.game
    if (frame === undefined) {
      if (game !== undefined) game.view.visible = false
      sized(logical.resolution)
      renderer.background.color = latest.background
    } else {
      if (game === undefined) {
        game = createGameView(logical)
        stage.addChildAt(game.view, 0)
      }
      game.view.visible = true
      sized(fieldResolution())
      game.resize(logical)
      game.show(frame)
      renderer.background.color = game.backdrop(frame.scene)
    }
    paintInto(graphics, latest)
    renderer.render(stage)
  }

  const onLost = (): void => {
    lost = true
    paused.set(true)
  }
  const onRestored = (): void => {
    lost = false
    paused.set(false)
    render()
  }
  stage.addChild(graphics)
  canvas.addEventListener('webglcontextlost', onLost)
  canvas.addEventListener('webglcontextrestored', onRestored)

  return {
    paused: { subscribe: paused.subscribe },
    draw(paint) {
      latest = paint
      render()
    },
    resize(next) {
      if (destroyed) return
      logical = next
      render()
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
      paused.set(false)
      game?.destroy()
      stage.destroy({ children: true })
      renderer.destroy({ removeView: false })
    },
  }
}

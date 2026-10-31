import { Graphics, type Renderer } from 'pixi.js'
import { type Readable, writable } from 'svelte/store'
import type { DollhousePaint } from '../../app/dollhouse-paint'
import { createWebGL2Renderer, type RendererSize } from '../plan/plan-renderer'

// The Dollhouse view's renderer (ED3D.5e, ED3D-D6: editor-private, flat-shaded, not `@pixi/3d`): a WebGL2 Pixi renderer
// that fills a `DollhousePaint`'s triangles in order (the list is already far to near) in one `Graphics`, a selected one
// tinted and outlined in the accent. Losing the context pauses it and keeps the newest list, as the plan's does (ED3D
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

function paintInto(graphics: Graphics, paint: DollhousePaint): void {
  graphics.clear()
  for (const polygon of paint.polygons) {
    graphics.poly([...polygon.points]).fill({ color: polygon.color, alpha: polygon.alpha })
    if (!polygon.selected) continue
    graphics
      .poly([...polygon.points])
      .fill({ color: paint.accent, alpha: SELECTED_TINT * polygon.alpha })
      .stroke({ color: paint.accent, width: 2, alignment: 0.5, join: 'round' })
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
  const paused = writable(false)
  let lost = false
  let destroyed = false
  let latest: DollhousePaint | undefined

  function render(): void {
    if (lost || destroyed || latest === undefined) return
    renderer.background.color = latest.background
    paintInto(graphics, latest)
    renderer.render(graphics)
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
      renderer.resize(next.w, next.h, next.resolution)
      render()
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
      paused.set(false)
      graphics.destroy()
      renderer.destroy({ removeView: false })
    },
  }
}

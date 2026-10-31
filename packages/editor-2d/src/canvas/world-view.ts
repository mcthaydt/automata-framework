import { Container, Graphics, type Renderer, Text } from 'pixi.js'
import { writable } from 'svelte/store'
import type { WorldRect } from '../app/world/world-model'
import type { ColorResolver } from './colors'
import { type Camera, createWebGL2Renderer } from './level-view'

// The World view's map (plan ED2D.6b step 4; 2D editor spec §8, the World row): each level a rectangle at its world
// position, the selected one outlined in the accent, its name in the top-left corner at screen size. A world has a few
// dozen levels at most, so each render redraws everything. Like the level canvas it is WebGL2 only and says when its
// context is lost; `paused` follows `webglcontextlost` and `webglcontextrestored`.

export interface WorldViewOptions {
  readonly canvas: HTMLCanvasElement
  readonly colors: ColorResolver
  readonly width: number
  readonly height: number
  readonly resolution: number
}

export interface WorldView {
  readonly paused: { subscribe(run: (paused: boolean) => void): () => void }
  render(rects: readonly WorldRect[], camera: Camera): void
  resize(width: number, height: number, resolution: number): void
  destroy(): void
}

/** The outline in screen pixels, drawn inside the rectangle so neighbours touching it keep their own edge. */
const OUTLINE = 2
const LABEL_INSET = 6

export async function createWorldView(options: WorldViewOptions): Promise<WorldView | undefined> {
  const { canvas, colors } = options
  const created = await createWebGL2Renderer({
    canvas,
    width: options.width,
    height: options.height,
    resolution: options.resolution,
    background: colors('bg/canvas'),
    antialias: false,
  })
  if (created === undefined) return undefined
  const renderer: Renderer = created
  const stage = new Container()
  const shapes = new Graphics()
  const labels = new Container()
  stage.addChild(shapes, labels)
  const paused = writable(false)
  let lost = false
  let destroyed = false
  let latest: { readonly rects: readonly WorldRect[]; readonly camera: Camera } | undefined

  function draw(): void {
    if (lost || destroyed || latest === undefined) return
    const { rects, camera } = latest
    shapes.clear()
    for (const label of labels.removeChildren()) label.destroy()
    for (const rect of rects) {
      const x = camera.x + rect.x * camera.scale
      const y = camera.y + rect.y * camera.scale
      const w = rect.w * camera.scale
      const h = rect.h * camera.scale
      shapes
        .rect(x, y, w, h)
        .fill(colors('bg/field'))
        .stroke({
          width: OUTLINE,
          color: colors(rect.selected ? 'accent/default' : 'border/strong'),
          alignment: 1,
        })
      if (rect.name === '') continue
      const label = new Text({
        text: rect.name,
        style: { fill: colors('text/primary'), fontFamily: 'sans-serif', fontSize: 12 },
      })
      label.position.set(x + LABEL_INSET, y + LABEL_INSET)
      labels.addChild(label)
    }
    renderer.render(stage)
  }

  const onLost = (): void => {
    lost = true
    paused.set(true)
  }
  const onRestored = (): void => {
    lost = false
    paused.set(false)
    draw()
  }
  canvas.addEventListener('webglcontextlost', onLost)
  canvas.addEventListener('webglcontextrestored', onRestored)

  return {
    paused: { subscribe: paused.subscribe },
    render(rects, camera) {
      latest = { rects, camera }
      draw()
    },
    resize(width, height, resolution) {
      if (destroyed) return
      renderer.resize(width, height, resolution)
      draw()
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

import { Container, Graphics, type Renderer, Text } from 'pixi.js'
import { writable } from 'svelte/store'
import type { WorldLink } from '../app/world/world-links'
import type { WorldRect } from '../app/world/world-model'
import type { ColorResolver } from './colors'
import type { LevelDrawList } from './draw/draw-list-types'
import { createLevelScene, type LevelScene } from './level-scene'
import { type Camera, createWebGL2Renderer } from './level-view'
import type { TextureManager } from './textures.manager'

// The World view's map (plan ED2D.6b step 4; 2D editor spec §8, the World row): each level a rectangle at its world
// position, the selected one outlined in the accent, its name on a plate in the top-left corner at screen size; over them, each
// link between two levels as a curve with an arrowhead and its holder's label (ED2D.6c decision 5). Under the outlines,
// each level's picture: the level canvas's own scene over a draw list with no overlays, kept per level so only what
// changed is rebuilt (ED2D.8b decision 1). A world has a few
// dozen levels at most, so each render redraws everything. Like the level canvas it is WebGL2 only and says when its
// context is lost; `paused` follows `webglcontextlost` and `webglcontextrestored`.

export interface WorldViewOptions {
  readonly canvas: HTMLCanvasElement
  readonly colors: ColorResolver
  /** The images the levels' pictures use; the map loads them. */
  readonly textures: TextureManager
  readonly width: number
  readonly height: number
  readonly resolution: number
}

export interface WorldView {
  readonly paused: { subscribe(run: (paused: boolean) => void): () => void }
  /** `pictures`: each level's draw list by level id; a level without one is a plain rectangle. */
  render(
    rects: readonly WorldRect[],
    camera: Camera,
    links: readonly WorldLink[],
    pictures?: ReadonlyMap<string, LevelDrawList>,
  ): void
  resize(width: number, height: number, resolution: number): void
  destroy(): void
}

/** The outline in screen pixels, drawn inside the rectangle so neighbours touching it keep their own edge. */
const OUTLINE = 2
const LABEL_INSET = 6
/** Screen pixels: the name plate's padding and corner radius (plan ED2D.8c). */
const PLATE_PAD = 4
const PLATE_RADIUS = 4
/** Screen pixels: the link's line width, its arrowhead's length and the gap between its label and the curve. */
const LINK_WIDTH = 2
const ARROW = 9
const LINK_LABEL_GAP = 4

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
  const fills = new Graphics()
  const scenesRoot = new Container()
  const shapes = new Graphics()
  const plates = new Graphics()
  const labels = new Container()
  stage.addChild(fills, scenesRoot, shapes, plates, labels)
  const scenes = new Map<string, LevelScene>()
  const paused = writable(false)
  let lost = false
  let destroyed = false
  let latest:
    | {
        readonly rects: readonly WorldRect[]
        readonly camera: Camera
        readonly links: readonly WorldLink[]
        readonly pictures: ReadonlyMap<string, LevelDrawList>
      }
    | undefined

  /** Each pictured level's scene at its rectangle; a level no longer pictured has its scene destroyed. */
  function drawPictures(
    rects: readonly WorldRect[],
    camera: Camera,
    pictures: ReadonlyMap<string, LevelDrawList>,
  ) {
    const shown: Container[] = []
    for (const rect of rects) {
      const list = pictures.get(rect.id)
      if (list === undefined) continue
      let scene = scenes.get(rect.id)
      if (scene === undefined) {
        scene = createLevelScene({ textures: options.textures, colors })
        scenes.set(rect.id, scene)
      }
      // Drawn as Home's thumbnails are: labels at the level's own scale, so they shrink with the picture, and no link
      // chips, since the map draws the links between levels itself.
      scene.update(list.links.length === 0 ? list : { ...list, links: [] })
      scene.root.position.set(camera.x + rect.x * camera.scale, camera.y + rect.y * camera.scale)
      scene.root.scale.set(camera.scale)
      shown.push(scene.root)
    }
    for (const [id, scene] of scenes)
      if (!pictures.has(id) || !rects.some((rect) => rect.id === id)) {
        scene.destroy()
        scenes.delete(id)
      }
    scenesRoot.removeChildren()
    if (shown.length > 0) scenesRoot.addChild(...shown)
  }

  function draw(): void {
    if (lost || destroyed || latest === undefined) return
    const { rects, camera, links, pictures } = latest
    fills.clear()
    shapes.clear()
    plates.clear()
    for (const label of labels.removeChildren()) label.destroy()
    for (const rect of rects) {
      const x = camera.x + rect.x * camera.scale
      const y = camera.y + rect.y * camera.scale
      const w = rect.w * camera.scale
      const h = rect.h * camera.scale
      fills.rect(x, y, w, h).fill(colors('bg/field'))
      shapes.rect(x, y, w, h).stroke({
        width: OUTLINE,
        color: colors(rect.selected ? 'accent/default' : 'border/strong'),
        alignment: 1,
      })
      if (rect.name === '') continue
      const label = new Text({
        text: rect.name,
        style: { fill: colors('text/primary'), fontFamily: 'sans-serif', fontSize: 12 },
      })
      // On an opaque plate, so a busy picture under the name cannot swallow it (plan ED2D.8c).
      plates
        .roundRect(
          x + LABEL_INSET,
          y + LABEL_INSET,
          label.width + 2 * PLATE_PAD,
          label.height + PLATE_PAD,
          PLATE_RADIUS,
        )
        .fill(colors('bg/surface'))
      label.position.set(x + LABEL_INSET + PLATE_PAD, y + LABEL_INSET + PLATE_PAD / 2)
      labels.addChild(label)
    }
    const screen = (point: { x: number; y: number }) => ({
      x: camera.x + point.x * camera.scale,
      y: camera.y + point.y * camera.scale,
    })
    for (const link of links) {
      const color = colors(link.color ?? 'accent/default')
      const start = screen(link.start)
      const control = screen(link.control)
      const end = screen(link.end)
      const angle = Math.atan2(end.y - control.y, end.x - control.x)
      shapes
        .moveTo(start.x, start.y)
        .quadraticCurveTo(control.x, control.y, end.x, end.y)
        .moveTo(end.x - ARROW * Math.cos(angle - 0.45), end.y - ARROW * Math.sin(angle - 0.45))
        .lineTo(end.x, end.y)
        .lineTo(end.x - ARROW * Math.cos(angle + 0.45), end.y - ARROW * Math.sin(angle + 0.45))
        .stroke({ width: LINK_WIDTH, color, join: 'round' })
      const middle = screen(link.middle)
      const label = new Text({
        text: link.label,
        style: { fill: color, fontFamily: 'sans-serif', fontSize: 11 },
      })
      label.anchor.set(0.5, 1)
      label.position.set(middle.x, middle.y - LINK_LABEL_GAP)
      labels.addChild(label)
    }
    drawPictures(rects, camera, pictures)
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
    render(rects, camera, links, pictures = new Map()) {
      latest = { rects, camera, links, pictures }
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
      for (const scene of scenes.values()) scene.destroy()
      scenes.clear()
      stage.destroy({ children: true })
      renderer.destroy({ removeView: false })
    },
  }
}

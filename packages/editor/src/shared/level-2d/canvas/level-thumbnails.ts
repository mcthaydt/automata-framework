import { Container, Rectangle, type Renderer } from 'pixi.js'
import type { LevelPreview } from '../profiles/profile'
import type { ColorResolver } from './colors'
import type { DrawView } from './draw/draw-list-types'
import { createLevelDrawList } from './draw/level-draw-list'
import { levelImages } from './draw/level-images'
import { createLevelScene } from './level-scene'
import { createWebGL2Renderer } from './level-view'
import { createTextureManager } from './textures.manager'

// Home's card thumbnails: a project's preview level drawn by the same scene builder as
// the canvas, with no overlays, fitted into 96 × 96 px and handed back as a PNG data URL. One offscreen WebGL renderer,
// made on the first request, draws one thumbnail at a time; each key (the card's file path, size and modification
// time, and its images' modification times) is drawn once. Each draw reads its images into textures of its own and
// destroys them after, so nothing is held between cards. Without WebGL2 every answer is `undefined` and the card keeps
// its initial.

/** The largest side of a thumbnail in px: twice the card's 48 px tile, for a sharp image on a 2× screen. */
const THUMBNAIL_SIDE = 96

export interface LevelThumbnailsOptions {
  /** Reads a workspace file's bytes (the workspace store's `read`). */
  read(path: string): Promise<Uint8Array | undefined>
  readonly colors: ColorResolver
  /** A canvas element for the offscreen renderer (`document.createElement('canvas')`). */
  makeCanvas(): HTMLCanvasElement
}

export interface LevelThumbnails {
  /** A PNG data URL of `preview`'s level; the same promise for the same key. */
  thumbnail(key: string, preview: LevelPreview): Promise<string | undefined>
  dispose(): void
}

/** A view with no active layer and nothing hovered or selected, so the draw list has no overlays: Home's thumbnails
 * and the World map's pictures. */
export const plainDrawView = (level: string): DrawView => ({
  level,
  layer: '',
  tool: 'select',
  brushSize: 1,
  hover: undefined,
  rectangle: undefined,
  selected: [],
  hidden: new Set(),
  locked: new Set(),
})

export function createLevelThumbnails(options: LevelThumbnailsOptions): LevelThumbnails {
  const { colors } = options
  const drawn = new Map<string, Promise<string | undefined>>()
  let renderer: Promise<Renderer | undefined> | undefined
  let queue: Promise<unknown> = Promise.resolve()
  let disposed = false

  function rendererOnce(): Promise<Renderer | undefined> {
    renderer ??= createWebGL2Renderer({
      canvas: options.makeCanvas(),
      width: THUMBNAIL_SIDE,
      height: THUMBNAIL_SIDE,
      backgroundAlpha: 0,
      antialias: false,
    })
    return renderer
  }

  async function draw(preview: LevelPreview): Promise<string | undefined> {
    const current = await rendererOnce()
    if (current === undefined || disposed) return undefined
    const { project, level } = preview
    const textures = createTextureManager({ read: (path) => options.read(path) })
    const scene = createLevelScene({ textures, colors })
    const stage = new Container()
    stage.addChild(scene.root)
    try {
      await textures.load(levelImages(project, level))
      if (disposed) return undefined
      const list = createLevelDrawList()({
        project,
        view: plainDrawView(level),
        images: textures.loaded,
        generations: textures.generations,
      })
      const scale = Math.min(THUMBNAIL_SIDE / list.size.w, THUMBNAIL_SIDE / list.size.h)
      scene.update(list, scale)
      scene.root.scale.set(scale)
      const frame = new Rectangle(0, 0, Math.round(list.size.w * scale), Math.round(list.size.h * scale))
      return await current.extract.base64({ target: stage, frame, format: 'png' })
    } catch {
      // A preview naming a level that is not there, a context lost mid-draw, or a level the renderer cannot hold: no
      // thumbnail, the card keeps its initial, and the queue goes on to the next card.
      return undefined
    } finally {
      stage.destroy({ children: true })
      textures.destroy()
    }
  }

  return {
    thumbnail(key, preview) {
      if (disposed) return Promise.resolve(undefined)
      let answer = drawn.get(key)
      if (answer === undefined) {
        answer = queue.then(() => draw(preview))
        queue = answer
        drawn.set(key, answer)
      }
      return answer
    },
    dispose() {
      if (disposed) return
      disposed = true
      drawn.clear()
      void queue.then(async () => {
        ;(await renderer)?.destroy()
      })
    },
  }
}

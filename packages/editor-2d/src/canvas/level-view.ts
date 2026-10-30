import { autoDetectRenderer, Container, type Renderer } from 'pixi.js'
import { type Readable, writable } from 'svelte/store'
import type { Size } from '../model/project-types'
import type { ColorResolver } from './colors'
import type { LevelDrawList } from './draw/draw-list-types'
import { createLevelScene } from './level-scene'
import type { TextureManager } from './textures.manager'

// The level canvas (ED2D.4c3b; 2D editor spec §4, §8, §13; plan decisions 2, 7 and 8): a WebGL2 Pixi renderer on the
// page's canvas element, drawing a draw list at a camera. Losing the WebGL context (the GPU reset, the tab put to
// sleep) is not an error: Pixi keeps every texture source and re-uploads it once the browser restores the context, so
// the view only stops drawing, says it is paused, and draws the latest list again on `webglcontextrestored`. The
// document and its history never hear of it.

/** Where the level sits on the canvas: a screen point is `level point × scale + (x, y)`, in CSS pixels. */
export interface Camera {
  readonly x: number
  readonly y: number
  readonly scale: number
}

/** The camera that shows the whole level in `box`, as large as it fits, centred. */
export function fitCamera(size: Size, box: Size): Camera {
  const scale = Math.min(box.w / size.w, box.h / size.h)
  return { x: (box.w - size.w * scale) / 2, y: (box.h - size.h * scale) / 2, scale }
}

export interface LevelViewOptions {
  readonly canvas: HTMLCanvasElement
  readonly textures: TextureManager
  readonly colors: ColorResolver
  /** CSS pixels, and device pixels per CSS pixel. */
  readonly width: number
  readonly height: number
  readonly resolution: number
}

export interface LevelView {
  /** True from `webglcontextlost` until `webglcontextrestored`. */
  readonly paused: Readable<boolean>
  /** Draws `list` at `camera` now, or keeps it for when the context is back. */
  render(list: LevelDrawList, camera: Camera): void
  resize(width: number, height: number, resolution: number): void
  /** Releases the renderer and the scene; later calls do nothing. Leaves the canvas element and the textures alone. */
  destroy(): void
}

/** `undefined` when the page cannot give this canvas a WebGL context (plan decision 2: no other renderer). */
export async function createLevelView(options: LevelViewOptions): Promise<LevelView | undefined> {
  const { canvas, textures, colors } = options
  let renderer: Renderer
  try {
    renderer = await autoDetectRenderer({
      preference: ['webgl'],
      canvas,
      width: options.width,
      height: options.height,
      resolution: options.resolution,
      background: colors('bg/canvas'),
      antialias: false,
    })
  } catch {
    return undefined
  }
  const stage = new Container()
  const scene = createLevelScene({ textures, colors })
  stage.addChild(scene.root)
  const paused = writable(false)
  let lost = false
  let destroyed = false
  let latest: { readonly list: LevelDrawList; readonly camera: Camera } | undefined

  function draw(): void {
    if (lost || destroyed || latest === undefined) return
    const { list, camera } = latest
    scene.update(list, camera.scale)
    scene.root.position.set(camera.x, camera.y)
    scene.root.scale.set(camera.scale)
    renderer.render(stage)
  }

  const onLost = (): void => {
    lost = true
    paused.set(true)
  }
  // Pixi's own listener was added first, so its textures are re-made before this draws.
  const onRestored = (): void => {
    lost = false
    paused.set(false)
    draw()
  }
  canvas.addEventListener('webglcontextlost', onLost)
  canvas.addEventListener('webglcontextrestored', onRestored)

  return {
    paused: { subscribe: paused.subscribe },
    render(list, camera) {
      latest = { list, camera }
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
      scene.destroy()
      stage.destroy()
      renderer.destroy({ removeView: false })
    },
  }
}

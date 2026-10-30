import { CanvasSource, ImageSource, Rectangle, Texture } from 'pixi.js'
import type { Bounds } from '../model/commands/entity-geometry'
import type { Size } from '../model/project-types'

// The level canvas's textures (ED2D.4c3b; 2D editor spec §4, §11, §13; plan decision 5). Tileset and background images
// are workspace files under `assets/`: the manager reads their bytes through `read` (the workspace store), decodes them
// with `createImageBitmap` and keeps one texture per path, nearest-neighbour scaled for pixel art. An image that is
// missing, cannot be read or does not decode is left out of `loaded`, so the draw list draws `missing` placeholders for
// its tiles (ED2D-D11); a load never rejects. Numbered placeholders are textures too (plan decision 4), so a level of
// placeholders batches like one of art.

export interface TextureStore {
  read(path: string): Promise<Uint8Array | undefined>
}

export interface TextureManager {
  /** Loads each path not loaded yet; resolves when all have been tried. */
  load(paths: readonly string[]): Promise<void>
  /** The paths that have a texture: what the draw list takes as `images`. */
  readonly loaded: ReadonlySet<string>
  texture(path: string): Texture | undefined
  /** The part of a loaded image at `frame`, kept per rectangle; `undefined` when the image is not loaded. */
  frame(path: string, frame: Bounds): Texture | undefined
  /** A flat tile of `color` with `label` centred, for a tile of `size`; kept per label, colour and size. */
  placeholder(label: string, color: string, size: Size): Texture
  /** Drops an image and its frames, so the next `load` reads it again (an image replaced in the workspace). */
  forget(path: string): void
  destroy(): void
}

/** Placeholders are drawn at 4 × their tile so the number stays legible when zoomed, but never over 256 px a side. */
const PLACEHOLDER_SCALE = 4
const PLACEHOLDER_MAX = 256

async function decode(bytes: Uint8Array): Promise<ImageBitmap | undefined> {
  try {
    return await createImageBitmap(new Blob([bytes as Uint8Array<ArrayBuffer>]))
  } catch {
    return undefined
  }
}

function drawPlaceholder(label: string, color: string, size: Size): Texture {
  const scale = Math.min(PLACEHOLDER_SCALE, PLACEHOLDER_MAX / Math.max(size.w, size.h, 1))
  const w = Math.max(1, Math.round(size.w * scale))
  const h = Math.max(1, Math.round(size.h * scale))
  const canvas = new OffscreenCanvas(w, h)
  const context = canvas.getContext('2d')
  if (context !== null) {
    context.fillStyle = color
    context.fillRect(0, 0, w, h)
    // A darker inner edge marks each placeholder's cell, so neighbours of one colour stay apart.
    context.strokeStyle = 'rgba(0, 0, 0, 0.35)'
    context.lineWidth = Math.max(1, scale / 2)
    context.strokeRect(
      context.lineWidth / 2,
      context.lineWidth / 2,
      w - context.lineWidth,
      h - context.lineWidth,
    )
    context.fillStyle = 'rgba(255, 255, 255, 0.9)'
    context.font = `600 ${Math.round(Math.min(w, h) * 0.45)}px sans-serif`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(label, w / 2, h / 2)
  }
  return new Texture({ source: new CanvasSource({ resource: canvas as unknown as HTMLCanvasElement }) })
}

interface Image {
  readonly texture: Texture
  readonly bitmap: ImageBitmap
  readonly frames: Map<string, Texture>
}

export function createTextureManager(store: TextureStore): TextureManager {
  const images = new Map<string, Image>()
  const loaded = new Set<string>()
  const placeholders = new Map<string, Texture>()

  async function loadOne(path: string): Promise<void> {
    let bytes: Uint8Array | undefined
    try {
      bytes = await store.read(path)
    } catch {
      return
    }
    if (bytes === undefined) return
    const bitmap = await decode(bytes)
    // Loaded twice at once (two loads racing): the first to finish wins, the other bitmap is let go.
    if (bitmap === undefined || images.has(path)) {
      bitmap?.close()
      return
    }
    const source = new ImageSource({ resource: bitmap, scaleMode: 'nearest' })
    images.set(path, { texture: new Texture({ source }), bitmap, frames: new Map() })
    loaded.add(path)
  }

  function forget(path: string): void {
    const image = images.get(path)
    if (image === undefined) return
    for (const frame of image.frames.values()) frame.destroy(false)
    image.texture.destroy(true)
    image.bitmap.close()
    images.delete(path)
    loaded.delete(path)
  }

  return {
    async load(paths) {
      await Promise.all(paths.filter((path) => !images.has(path)).map(loadOne))
    },
    loaded,
    texture: (path) => images.get(path)?.texture,
    frame(path, frame) {
      const image = images.get(path)
      if (image === undefined) return undefined
      const key = `${frame.x},${frame.y},${frame.w},${frame.h}`
      let texture = image.frames.get(key)
      if (texture === undefined) {
        texture = new Texture({
          source: image.texture.source,
          frame: new Rectangle(frame.x, frame.y, frame.w, frame.h),
        })
        image.frames.set(key, texture)
      }
      return texture
    },
    placeholder(label, color, size) {
      const key = `${label}|${color}|${size.w}x${size.h}`
      let texture = placeholders.get(key)
      if (texture === undefined) {
        texture = drawPlaceholder(label, color, size)
        placeholders.set(key, texture)
      }
      return texture
    },
    forget,
    destroy() {
      for (const path of [...images.keys()]) forget(path)
      for (const texture of placeholders.values()) texture.destroy(true)
      placeholders.clear()
    },
  }
}

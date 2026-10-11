import { Texture } from 'pixi.js'
import type { PixelSprite } from '../art/sprites.ts'
import { lightLevel } from './light-levels.ts'

function canvasOf(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (context === null) throw new Error('no 2D canvas to paint sprites with')
  return [canvas, context]
}

/** Paints a pixel map onto a canvas, one fillRect per pixel, and wraps it as a texture (nearest scaling). */
export function textureFromPixels(sprite: PixelSprite): Texture {
  const [canvas, context] = canvasOf(sprite.width, sprite.height)
  sprite.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = sprite.palette[row.charAt(x)]
      if (color === undefined) continue // '.' is transparent
      context.fillStyle = color
      context.fillRect(x, y, 1, 1)
    }
  })
  return Texture.from(canvas)
}

const lights = new Map<number, Texture>()

/** A white pixel light of `radius` pixels (stepped and dithered, light-levels.ts), tinted where it is used. */
export function lightTexture(radius: number): Texture {
  const cached = lights.get(radius)
  if (cached !== undefined) return cached
  const size = radius * 2
  const [canvas, context] = canvasOf(size, size)
  const image = context.createImageData(size, size)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const at = (y * size + x) * 4
      image.data[at] = 255
      image.data[at + 1] = 255
      image.data[at + 2] = 255
      image.data[at + 3] = Math.round(lightLevel(x, y, radius) * 255)
    }
  context.putImageData(image, 0, 0)
  const texture = Texture.from(canvas)
  lights.set(radius, texture)
  return texture
}

/**
 * A smooth darkening toward the corners in `color`, at most `strength` opaque. Smooth rather than dithered: a
 * dither pattern this large shows as a checkerboard over bright things near the edges, like the moon.
 */
export function vignetteTexture(width: number, height: number, color: string, strength: number): Texture {
  const [canvas, context] = canvasOf(width, height)
  const image = context.createImageData(width, height)
  const radius = Math.hypot(width, height) / 2
  const r = Number.parseInt(color.slice(1, 3), 16)
  const g = Number.parseInt(color.slice(3, 5), 16)
  const b = Number.parseInt(color.slice(5, 7), 16)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const distance = Math.hypot(x + 0.5 - width / 2, y + 0.5 - height / 2) / radius
      // Clear in the middle 55 %, then easing up to `strength` at the corners.
      const edge = Math.min(1, Math.max(0, (distance - 0.55) / 0.45))
      const at = (y * width + x) * 4
      image.data[at] = r
      image.data[at + 1] = g
      image.data[at + 2] = b
      image.data[at + 3] = Math.round(edge * edge * strength * 255)
    }
  context.putImageData(image, 0, 0)
  return Texture.from(canvas)
}

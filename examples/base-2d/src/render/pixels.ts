import { Texture } from 'pixi.js'
import type { PixelSprite } from '../art/sprites.ts'

/** Paints a pixel map onto a canvas, one fillRect per pixel, and wraps it as a texture (nearest scaling). */
export function textureFromPixels(sprite: PixelSprite): Texture {
  const canvas = document.createElement('canvas')
  canvas.width = sprite.width
  canvas.height = sprite.height
  const context = canvas.getContext('2d')
  if (context === null) throw new Error('no 2D canvas to paint sprites with')
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

import { describe, expect, it } from 'vitest'
import { spriteStyle } from '#src/shared/level-2d/editor/tile-sprite.ts'

describe('a tile as a CSS sprite', () => {
  const image = { path: 'assets/terrain.png', size: { w: 128, h: 64 }, frame: { x: 32, y: 16, w: 16, h: 16 } }

  it('scales the image so one tile fills the cell, and shows the tile’s frame', () => {
    expect(spriteStyle({ image, color: '#123456' }, 'blob:terrain', 44)).toBe(
      'background-image: url("blob:terrain"); background-size: 352px 176px; background-position: -88px -44px',
    )
  })

  it('is the flat placeholder colour without an image, or before the image is read', () => {
    expect(spriteStyle({ image: undefined, color: '#123456' }, undefined, 44)).toBe(
      'background-color: #123456',
    )
    expect(spriteStyle({ image, color: '#123456' }, undefined, 30)).toBe('background-color: #123456')
  })
})

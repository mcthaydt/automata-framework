import type { TileImage } from './level/palette-model'

// One tile drawn as a CSS sprite (plan ED2D.5b decision 8): the tileset image scaled so the tile's frame fills a square
// cell and shifted to that frame. Without an image, or until it is read, the tile is the flat placeholder colour the
// canvas draws, so the palette, the tileset sheet, the rule rows and the preview cut tiles one way.

export interface SpriteTile {
  readonly image: TileImage | undefined
  readonly color: string
}

export function spriteStyle(tile: SpriteTile, url: string | undefined, cell: number): string {
  if (tile.image === undefined || url === undefined) return `background-color: ${tile.color}`
  const { size, frame } = tile.image
  const scale = cell / Math.max(frame.w, frame.h)
  return [
    `background-image: url("${url}")`,
    `background-size: ${size.w * scale}px ${size.h * scale}px`,
    `background-position: ${-frame.x * scale}px ${-frame.y * scale}px`,
  ].join('; ')
}

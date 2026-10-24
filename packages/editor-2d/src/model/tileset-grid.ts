import type { TilesetDef } from './project-types'

// How many tiles a tileset holds (2D editor spec §5.4): columns and rows derive from the image size, the tile size, the
// spacing between tiles and the padding around the image. A tileset without an image is a placeholder, and its
// `imageSize` is what the image will be, so the count is the same.

/** Whole tiles along one side: `padding` on both ends, `spacing` between tiles but not after the last. */
const along = (image: number, tile: number, spacing: number, padding: number): number =>
  Math.max(0, Math.floor((image - 2 * padding + spacing) / (tile + spacing)))

export function tilesetTiles(def: TilesetDef): { columns: number; rows: number; count: number } {
  const columns = along(def.imageSize.w, def.tile.w, def.spacing, def.padding)
  const rows = along(def.imageSize.h, def.tile.h, def.spacing, def.padding)
  return { columns, rows, count: columns * rows }
}

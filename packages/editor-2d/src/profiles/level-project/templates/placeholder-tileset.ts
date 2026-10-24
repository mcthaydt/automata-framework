import type { TilesetDef } from '../../../model/project-types'

// A tileset a template starts with (2D editor spec §7, ED2D-D11): a definition with no image. The canvas draws each
// tile as a flat colour with its index, and the Assets list says "placeholder"; importing a PNG of the same size sets
// `image` and keeps every tile index, so a project built on placeholders moves to real art by one replace.

export interface PlaceholderTilesetOptions {
  readonly id: string
  /** The name without the word "placeholder", which this adds. */
  readonly label: string
  readonly columns: number
  readonly rows: number
  /** Side of a square tile in px. */
  readonly tile: number
  readonly tags: TilesetDef['tags']
}

export function placeholderTileset(options: PlaceholderTilesetOptions): TilesetDef {
  return {
    id: options.id,
    label: `${options.label} (placeholder)`,
    imageSize: { w: options.columns * options.tile, h: options.rows * options.tile },
    tile: { w: options.tile, h: options.tile },
    spacing: 0,
    padding: 0,
    tags: options.tags,
  }
}

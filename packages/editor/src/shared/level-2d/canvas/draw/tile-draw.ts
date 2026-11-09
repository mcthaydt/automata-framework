import { PLACEHOLDER_COLORS, placeholderColor, tileFrame } from '@automata/content/level-2d'
import type { Bounds } from '../../model/commands/entity-geometry'
import type { TilesetDef } from '../../model/project-types'
import { tilesetTiles } from '../../model/tileset-grid'
import type { PlaceholderReason, TileDraw } from './draw-list-types'

// Where a tile comes from: a frame of its tileset's image when that image is
// loaded and the index is inside the set, otherwise a flat placeholder with the index on it. Never a fake picture, and
// never a crash: a missing image degrades its tiles, not the document.

export { PLACEHOLDER_COLORS }

interface TileChoice {
  readonly tile: number
  readonly flipX: boolean
  readonly flipY: boolean
}

/** The image a tile is cut from, or why there is none. */
function sourceOf(
  tileset: TilesetDef | undefined,
  images: ReadonlySet<string>,
  tile: number,
): { readonly image: string; readonly tileset: TilesetDef } | PlaceholderReason {
  if (tileset === undefined) return 'noTileset'
  if (tile >= tilesetTiles(tileset).count) return 'outOfRange'
  if (tileset.image === undefined) return 'placeholder'
  if (!images.has(tileset.image)) return 'missing'
  return { image: tileset.image, tileset }
}

/** `choice` drawn into `at` (level pixels) from `tileset`, given the image paths that are loaded. */
export function tileDraw(
  tileset: TilesetDef | undefined,
  images: ReadonlySet<string>,
  choice: TileChoice,
  at: Bounds,
): TileDraw {
  const placed = { ...at, tile: choice.tile, flipX: choice.flipX, flipY: choice.flipY }
  const source = sourceOf(tileset, images, choice.tile)
  if (typeof source === 'string') {
    return {
      ...placed,
      kind: 'placeholder',
      reason: source,
      color: placeholderColor(choice.tile),
      label: String(choice.tile),
    }
  }
  const { padding, spacing, tile } = source.tileset
  const { columns, rows } = tilesetTiles(source.tileset)
  const frame = tileFrame({ tile, spacing, padding, columns, rows }, choice.tile)
  // `sourceOf` has checked the index against the set, so the frame is there.
  if (frame === undefined) throw new RangeError(`tile ${choice.tile} is outside its tileset`)
  return { ...placed, kind: 'image', image: source.image, frame }
}

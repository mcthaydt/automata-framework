import type { Bounds } from '../../model/commands/entity-geometry'
import type { TilesetDef } from '../../model/project-types'
import { tilesetTiles } from '../../model/tileset-grid'
import type { PlaceholderReason, TileDraw } from './draw-list-types'

// Where a tile comes from: a frame of its tileset's image when that image is
// loaded and the index is inside the set, otherwise a flat placeholder with the index on it. Never a fake picture, and
// never a crash: a missing image degrades its tiles, not the document.

/**
 * Twelve flat colours far enough apart to tell neighbouring indices apart; tile `n` takes colour `n % 12`, so a
 * placeholder looks the same wherever it is drawn and whatever happened to the image.
 */
export const PLACEHOLDER_COLORS: readonly string[] = [
  '#8a6d5a',
  '#5a7d8a',
  '#7a8a5a',
  '#8a5a7a',
  '#5a8a6d',
  '#6d5a8a',
  '#8a7f5a',
  '#5a6d8a',
  '#8a5a5a',
  '#5a8a85',
  '#7d8a74',
  '#80748a',
]

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
      color: PLACEHOLDER_COLORS[choice.tile % PLACEHOLDER_COLORS.length] as string,
      label: String(choice.tile),
    }
  }
  const { padding, spacing, tile } = source.tileset
  const { columns } = tilesetTiles(source.tileset)
  const frame = {
    x: padding + (choice.tile % columns) * (tile.w + spacing),
    y: padding + Math.floor(choice.tile / columns) * (tile.h + spacing),
    w: tile.w,
    h: tile.h,
  }
  return { ...placed, kind: 'image', image: source.image, frame }
}

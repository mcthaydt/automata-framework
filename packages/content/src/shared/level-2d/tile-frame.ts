import type { ContentSize, ContentTileset } from './content.schema.ts'

// Where a tile sits in its tileset's picture, and what a tile looks like when it has no picture. The editor draws
// the same, so a level looks alike in the editor and in the game.

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

/** The placeholder colour of tile `tile`. */
export const placeholderColor = (tile: number): string =>
  PLACEHOLDER_COLORS[tile % PLACEHOLDER_COLORS.length] as string

/** The rectangle of tile `tile` in the tileset's picture, or undefined when the index is past the set. */
export function tileFrame(
  tileset: Pick<ContentTileset, 'tile' | 'columns' | 'rows' | 'spacing' | 'padding'>,
  tile: number,
): (ContentSize & { readonly x: number; readonly y: number }) | undefined {
  if (!Number.isInteger(tile) || tile < 0 || tile >= tileset.columns * tileset.rows) return undefined
  const { padding, spacing } = tileset
  return {
    x: padding + (tile % tileset.columns) * (tileset.tile.w + spacing),
    y: padding + Math.floor(tile / tileset.columns) * (tileset.tile.h + spacing),
    w: tileset.tile.w,
    h: tileset.tile.h,
  }
}

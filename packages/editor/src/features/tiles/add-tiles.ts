// Add tiles: a picture of tiles becomes something to paint with. Pure: the picture's size and one tile
// size give the grid and the words the dialog shows; the picture's file name gives the file to write and the tileset
// to add. The dialog (`AddTilesDialog.svelte`) draws this and the session adds the tileset as one undo step.
import type { Size, TilesetDef } from '../../shared/level-2d/model/project-types'
import { slugOf, unused } from '../../shared/pictures/pick-picture'

export { pictureAsset } from '../../shared/pictures/pick-picture'

/** The range a suggested tile size is drawn from. */
const SMALLEST_SUGGESTION = 8
const LARGEST_SUGGESTION = 64

export interface TileGrid {
  readonly columns: number
  readonly rows: number
  readonly count: number
  /** "This makes 64 tiles.", when the size fits the picture exactly. */
  readonly summary: string | undefined
  /** Why the size does not fit, in plain words, with sizes that would; the primary action waits while there is one. */
  readonly problem: string | undefined
}

/** Tile sizes that divide both sides, nearest to `tile` first (a tie goes to the larger), at most two, smallest first. */
function suggestions(picture: Size, tile: number): number[] {
  const largest = Math.min(LARGEST_SUGGESTION, Math.floor(Math.min(picture.w, picture.h) / 2))
  const fits: number[] = []
  for (let size = SMALLEST_SUGGESTION; size <= largest; size++) {
    if (picture.w % size === 0 && picture.h % size === 0) fits.push(size)
  }
  const nearest = fits.sort((a, b) => Math.abs(a - tile) - Math.abs(b - tile) || b - a).slice(0, 2)
  return nearest.sort((a, b) => a - b)
}

/** What one side says when `tile` does not fit it, or `undefined` when it does. */
function sideProblem(length: number, word: 'wide' | 'high', tile: number): string | undefined {
  if (length < tile) return `The picture is ${length} px ${word}, smaller than one ${tile} px tile.`
  const over = length % tile
  return over === 0
    ? undefined
    : `The picture is ${length} px ${word}; ${tile} px tiles leave ${over} px over.`
}

/** The grid `tile`-pixel square tiles make of `picture`, and what the dialog says about it. */
export function tileGrid(picture: Size, tile: number): TileGrid {
  const columns = Math.floor(picture.w / tile)
  const rows = Math.floor(picture.h / tile)
  const side = sideProblem(picture.w, 'wide', tile) ?? sideProblem(picture.h, 'high', tile)
  if (side === undefined) {
    const count = columns * rows
    return {
      columns,
      rows,
      count,
      summary: `This makes ${count} tile${count === 1 ? '' : 's'}.`,
      problem: undefined,
    }
  }
  // A picture smaller than the tile is answered by a smaller tile, not by a list of sizes.
  const tryThese = picture.w < tile || picture.h < tile ? [] : suggestions(picture, tile)
  const advice = tryThese.length === 0 ? '' : ` Try ${tryThese.join(' or ')}.`
  return { columns, rows, count: columns * rows, summary: undefined, problem: side + advice }
}

export interface Picture {
  readonly fileName: string
  /** Where `pictureAsset` put it. */
  readonly path: string
  readonly size: Size
  readonly tile: number
  /** The tileset ids already in the project. */
  readonly taken: readonly string[]
}

/** The tileset the picture becomes: named after the file in words ("Forest tiles"), square tiles, no tags yet. */
export function tilesetFromPicture(picture: Picture): TilesetDef {
  const slug = slugOf(picture.fileName)
  const words = slug.replace(/-/g, ' ')
  return {
    id: unused(slug, new Set(picture.taken), (name) => name),
    label: words.charAt(0).toUpperCase() + words.slice(1),
    image: picture.path,
    imageSize: picture.size,
    tile: { w: picture.tile, h: picture.tile },
    spacing: 0,
    padding: 0,
    tags: [],
  }
}

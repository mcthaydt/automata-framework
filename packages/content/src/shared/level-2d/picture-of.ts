import type { ContentEntityDef } from './content.schema.ts'

// How a character definition looks, decided once for the editor and the game: its animation's first frame when it has
// one, else its tile (only when its shape is tile, as the editor draws it), else its colour as a flat shape. The game
// plays the clips; the editor, which holds still, shows the first frame, so a level looks alike in both.

/** The grey for a colour that is missing or is a kit token the game cannot read (the editor's neutral). */
export const NEUTRAL_COLOR = '#8e8c85'

/** A look with no animation: a tile of a tileset, or a flat shape. */
export type StillPicture =
  | { readonly kind: 'tile'; readonly tileset: string; readonly index: number }
  | { readonly kind: 'flat'; readonly shape: 'rect' | 'ellipse' | 'point'; readonly color: string }

/**
 * A character with an animation: frame `index` of its first clip, cut from the picture `image` in `cell`-sized cells
 * (the frame's place depends on the picture's width, so whoever has the picture works it out). `still` is the look
 * to show while the picture is not there.
 */
export interface ClipPicture {
  readonly kind: 'clip'
  readonly image: string
  readonly cell: { readonly w: number; readonly h: number }
  readonly index: number
  readonly still: StillPicture
}

export type Picture = StillPicture | ClipPicture

function hexOf(value: string | undefined): string {
  if (value === undefined) return NEUTRAL_COLOR
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase()
  const three = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(value)
  if (three !== null)
    return `#${three[1]}${three[1]}${three[2]}${three[2]}${three[3]}${three[3]}`.toLowerCase()
  return NEUTRAL_COLOR
}

/** The picture of a definition without its animation: its tile, else its colour as its flat shape. */
function stillOf(def: Pick<ContentEntityDef, 'shape' | 'tile' | 'color'>): StillPicture {
  if (def.shape === 'tile' && def.tile !== undefined)
    return { kind: 'tile', tileset: def.tile.tileset, index: def.tile.index }
  return { kind: 'flat', shape: def.shape === 'tile' ? 'rect' : def.shape, color: hexOf(def.color) }
}

/** The picture of a definition: its animation's first frame, else its tile, else its colour as its flat shape. */
export function pictureOf(def: Pick<ContentEntityDef, 'shape' | 'tile' | 'color' | 'animation'>): Picture {
  const still = stillOf(def)
  const first = def.animation?.clips[0]?.frames[0]
  if (def.animation === undefined || first === undefined) return still
  return { kind: 'clip', image: def.animation.image, cell: def.animation.frame, index: first, still }
}

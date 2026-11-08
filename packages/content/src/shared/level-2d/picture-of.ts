import type { ContentEntityDef } from './content.schema.ts'

// How a character definition looks, decided once for the editor and the game. An animation's first clip arrives with
// the `animation` schema; until then a definition is its tile (only when its shape is tile, as the editor draws it)
// or its colour as a flat shape.

/** The grey for a colour that is missing or is a kit token the game cannot read (the editor's neutral). */
export const NEUTRAL_COLOR = '#8e8c85'

export type Picture =
  | { readonly kind: 'tile'; readonly tileset: string; readonly index: number }
  | { readonly kind: 'flat'; readonly shape: 'rect' | 'ellipse' | 'point'; readonly color: string }

function hexOf(value: string | undefined): string {
  if (value === undefined) return NEUTRAL_COLOR
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase()
  const three = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(value)
  if (three !== null)
    return `#${three[1]}${three[1]}${three[2]}${three[2]}${three[3]}${three[3]}`.toLowerCase()
  return NEUTRAL_COLOR
}

/** The picture of a definition: its tile, else its colour as its flat shape. */
export function pictureOf(def: Pick<ContentEntityDef, 'shape' | 'tile' | 'color'>): Picture {
  if (def.shape === 'tile' && def.tile !== undefined)
    return { kind: 'tile', tileset: def.tile.tileset, index: def.tile.index }
  return { kind: 'flat', shape: def.shape === 'tile' ? 'rect' : def.shape, color: hexOf(def.color) }
}

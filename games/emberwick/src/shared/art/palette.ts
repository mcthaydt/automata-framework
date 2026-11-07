// DUEL, AF's default palette (docs/art/palettes/duel.md): 256 colours as 32 ramps of 8, colour `r * 8 + s` on ramp `r`,
// step `s`. A game's art is DUEL colours by index; the palette itself is content (`@automata/content/palette`).

import { DEFAULT_PALETTE } from '@automata/content/palette'

/** A colour by its index in DUEL (0–255). */
export function duel(index: number): string {
  const colour = DEFAULT_PALETTE.colors[index]
  if (colour === undefined) throw new Error(`DUEL has no colour ${index}`)
  return colour
}

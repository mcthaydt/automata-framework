// What a piece file of the kit hands the register: the key a style's piece carries, and core's registration for it.

import type { HairPiece } from '@automata/3d/figures'

/** A hair piece of the kit: `kind` is the key a style's piece carries (`{ bun = { … } }`). */
export interface KitPiece {
  readonly kind: string
  // The register reads the data back as `unknown`, since each piece's own schema is what vouches for its type.
  // biome-ignore lint/suspicious/noExplicitAny: a heterogeneous list of pieces, each typed by its own file
  readonly piece: HairPiece<any>
}

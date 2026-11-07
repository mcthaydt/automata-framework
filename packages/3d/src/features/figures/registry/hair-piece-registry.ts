// H3, the hair pieces: how one entry of a style's `pieces` is built. Core registers none: the generators (scalp, rows,
// tail, fall, bun, sweep, block, edges) are @automata/character-kit's, and a game's own extension registers more here.
// A style then carries `{ <kind> = { … } }`. A name an earlier registration took is refused.
//
// Ported from FigureBuilder (mcthaydt/FigureBuilder) src/features/hair/hair.ts at 025ffb4 (`HairPiece`,
// `registerHairPiece`), with AF's strict types; a piece may carry a Zod schema, so its data is checked like the rest.

import type { z } from 'zod'
import { RegistryClash } from '../../../shared/registry/registry-clash.ts'
import type { HairBuild } from '../hair/hair-parts.ts'

/** A hair piece an extension registers: how one entry of a style's `pieces` is built. */
export interface HairPiece<T = unknown> {
  /** Checks the piece's data (the value under its kind's key); left out, any value is taken. */
  readonly schema?: z.ZodType<T>
  build(b: HairBuild, piece: T): void
  /** Its parts take the crown tag, like the scalp's and the rows': what is worn up on the head lies on them. */
  readonly crown?: boolean
}

const PIECES = new Map<string, HairPiece>()

/** Registers a hair piece under `kind`, the key a style's piece carries. Throws on a name taken. */
export function registerHairPiece<T>(kind: string, piece: HairPiece<T>): void {
  if (PIECES.has(kind)) throw new RegistryClash('hair piece', kind)
  PIECES.set(kind, piece as HairPiece)
}

/** The registered piece of a kind, or undefined. */
export const hairPieceOf = (kind: string): HairPiece | undefined => PIECES.get(kind)

/** Every registered kind with its piece, in registration order. */
export const registeredHairPieces = (): readonly (readonly [string, HairPiece])[] => [...PIECES]

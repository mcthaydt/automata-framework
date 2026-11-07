// Every prop generator by kind (a library preset names one with `kind`). A new look is new parameters; a new kind is a
// new generator in one of these files.
import { FURNITURE } from './furniture.ts'
import { NATURE } from './nature.ts'
import type { Generator } from './piece.ts'
import { SIGNS } from './signs.ts'
import { SMALL_THINGS } from './small-things.ts'
import { STREET } from './street.ts'

export const GENERATORS: Readonly<Record<string, Generator>> = {
  ...FURNITURE,
  ...SMALL_THINGS,
  ...STREET,
  ...NATURE,
  ...SIGNS,
}

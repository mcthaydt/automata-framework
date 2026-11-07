// Registers the kit's hair pieces and finishes with core's registries when this file loads. A style then carries
// `{ bun = { … } }` and names `finish = "braid"`; without the kit it is refused at its line.

import { registerFinish, registerHairPiece } from '@automata/3d/figures'
import { BLOCK } from './block.ts'
import { BUN } from './bun.ts'
import { EDGES } from './edges.ts'
import { FALL } from './fall.ts'
import type { KitPiece } from './kit-piece.ts'
import { ROWS } from './rows.ts'
import { SCALP } from './scalp.ts'
import { STRANDS } from './strands.ts'
import { SWEEP } from './sweep.ts'
import { TAIL } from './tail.ts'

/** The kit's hair pieces. */
export const KIT_PIECES: readonly KitPiece[] = [SCALP, ROWS, TAIL, FALL, STRANDS, BUN, SWEEP, BLOCK, EDGES]

/**
 * The finishes core has not: the matte ones (a coil, a braid, a loc, a curl: no glint, and their lit tone a step up too,
 * so a plait's beads or a loc's edge read on the dark side as well) and the glossy `smooth` (straight hair that gleams: a
 * low pony, a fall). Core has `sleek` and `straight`.
 */
export const KIT_FINISHES: Readonly<Record<string, { readonly matte: boolean }>> = {
  coil: { matte: true },
  braid: { matte: true },
  loc: { matte: true },
  smooth: { matte: false },
  curl: { matte: true },
}

for (const { kind, piece } of KIT_PIECES) registerHairPiece(kind, piece)
for (const [name, finish] of Object.entries(KIT_FINISHES)) registerFinish(name, finish)

// Where each piece of the play HUD sits and how much room it may take: the half of the `hud` file that names no
// extension and nothing of any game, so it can move to core unchanged when a second game, or the UI editor, needs it.
// A mistake is a sentence that says what is wrong and what is allowed.
import { z } from 'zod'

/** The nine places on the screen a piece may be pinned to. */
export const HUD_ANCHORS = [
  'top-left',
  'top',
  'top-right',
  'left',
  'centre',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right',
] as const
export type HudAnchor = (typeof HUD_ANCHORS)[number]

/** The pieces of the play HUD. */
export const HUD_PIECE_KINDS = ['objective', 'prompt', 'inventory', 'examine', 'keypad'] as const
export type HudPieceKind = (typeof HUD_PIECE_KINDS)[number]

export interface HudPiece {
  readonly kind: HudPieceKind
  readonly anchor: HudAnchor
  /** The most it may take, in CSS pixels; the screen's width caps it. Absent: as wide as the screen allows. */
  readonly width?: number | undefined
  /** Slot name → message key: the words the piece shows beyond the ones the game feeds it. */
  readonly words?: Readonly<Record<string, string>> | undefined
}

export interface HudLayout {
  readonly pieces: readonly HudPiece[]
}

const list = (values: readonly string[]): string => values.join(', ')

const pieceSchema: z.ZodType<HudPiece> = z.strictObject({
  kind: z.enum(HUD_PIECE_KINDS, {
    error: (issue) => `"${String(issue.input)}" is not a HUD piece; the pieces are ${list(HUD_PIECE_KINDS)}`,
  }),
  anchor: z.enum(HUD_ANCHORS, {
    error: (issue) =>
      `"${String(issue.input)}" is not a place on screen; the places are ${list(HUD_ANCHORS)}`,
  }),
  width: z.number().positive().optional(),
  words: z.record(z.string(), z.string()).optional(),
})

/** The pieces of a file, each kind at most once. */
export const piecesSchema: z.ZodType<readonly HudPiece[]> = z
  .array(pieceSchema)
  .superRefine((pieces, context) => {
    const seen = new Set<string>()
    pieces.forEach((piece, index) => {
      if (seen.has(piece.kind))
        context.addIssue({
          code: 'custom',
          path: [index, 'kind'],
          message: `the "${piece.kind}" piece may appear once; it appears twice`,
        })
      seen.add(piece.kind)
    })
  })

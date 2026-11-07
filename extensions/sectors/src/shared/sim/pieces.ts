// What each resolved edge builds, for collision: a solid wall is one piece floor to ceiling; a portal
// leaves only the strips its neighbour does not open. The step rule: a lower strip taller than `STEP` is a wall.
import { STEP } from '@automata/3d/level'

/** The floor and ceiling of the sectors on each side of an edge. */
export interface Span {
  readonly floor: number
  readonly ceiling: number
}

export type PieceKind = 'wall' | 'lower' | 'upper'

export interface PieceSpan {
  readonly y0: number
  readonly y1: number
  readonly kind: PieceKind
}

/** The pieces of an edge of `own`, a portal into `next` when there is one. */
export function pieceSpans(own: Span, next: Span | undefined): PieceSpan[] {
  if (!next) return [{ y0: own.floor, y1: own.ceiling, kind: 'wall' }]
  const out: PieceSpan[] = []
  if (next.floor > own.floor)
    out.push({ y0: own.floor, y1: Math.min(next.floor, own.ceiling), kind: 'lower' })
  if (next.ceiling < own.ceiling)
    out.push({ y0: Math.max(next.ceiling, own.floor), y1: own.ceiling, kind: 'upper' })
  return out
}

/** The opening a portal leaves, between the higher floor and the lower ceiling. */
export const opening = (own: Span, next: Span): { y0: number; y1: number } => ({
  y0: Math.max(own.floor, next.floor),
  y1: Math.min(own.ceiling, next.ceiling),
})

/** Pieces a walker cannot pass: solid walls and steps too tall to climb. */
export const walkBlocker = (piece: PieceSpan): boolean =>
  piece.kind === 'wall' || (piece.kind === 'lower' && piece.y1 - piece.y0 > STEP)

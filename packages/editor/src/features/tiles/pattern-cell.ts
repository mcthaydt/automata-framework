import type { PatternCell } from '../../shared/level-2d/tiles/autotile/rule.schema'

// How a pattern cell is drawn: one kind name per cell, which the thumbnail
// and the pattern editor style alike, so a rule row and its editor read the same.

export type PatternKind = 'any' | 'empty' | 'filled' | 'is' | 'not'

export const kindOf = (cell: PatternCell): PatternKind =>
  typeof cell === 'string' ? cell : 'is' in cell ? 'is' : 'not'

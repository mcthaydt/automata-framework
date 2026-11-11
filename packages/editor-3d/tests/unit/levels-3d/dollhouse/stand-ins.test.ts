import { describe, expect, it } from 'vitest'
import { type StandInKind, standInPieces } from '#src/features/levels-3d/dollhouse/stand-ins.ts'

// A stand-in belongs to no room, so it takes the normal shade (1) that every base room has: the baked light treats it
// like a piece in an ordinary room rather than a darker one.

const KINDS: readonly StandInKind[] = ['person', 'ember', 'goal', 'post', 'lamp']

describe('standInPieces', () => {
  it.each(KINDS)('gives every piece of a %s the normal shade, 1', (kind) => {
    const pieces = standInPieces({ id: 'thing', kind, at: [0, 0, 0], angle: 0 })
    expect(pieces.length).toBeGreaterThan(0)
    for (const piece of pieces) expect(piece.light).toBe(1)
  })
})

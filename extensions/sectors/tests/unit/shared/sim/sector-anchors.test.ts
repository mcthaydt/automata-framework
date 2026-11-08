import type { AfSector2 } from '@automata/3d/level'
import { describe, expect, it } from 'vitest'
import { sectorAnchors } from '#src/shared/sim/sector-anchors.ts'

// Where a cutscene's anchors stand in a 3D room: a person placed in the level, by the id the level editor gave them.
// A script says `actor:keeper`, and its actor starts where the room puts the keeper.

const level = {
  cast: [
    { id: 'keeper', who: 'keeper-figure', at: [4.5, 6] },
    { id: 'guard', who: 'guard-figure', at: [9, 2, 0.5] },
  ],
} as unknown as AfSector2

describe('sectorAnchors', () => {
  const where = sectorAnchors(level)

  it('answers where a placed person stands, in metres, by the name after "actor:"', () => {
    expect(where('actor:keeper')).toEqual({ x: 4.5, z: 6 })
    expect(where('actor:guard')).toEqual({ x: 9, z: 2 })
  })

  it('answers nothing for a person the room does not have, or an anchor of another kind', () => {
    expect(where('actor:nobody')).toBeUndefined()
    expect(where('keeper')).toBeUndefined()
    expect(where('player')).toBeUndefined()
  })

  it('answers nothing in a room with no cast', () => {
    expect(sectorAnchors({} as unknown as AfSector2)('actor:keeper')).toBeUndefined()
  })
})

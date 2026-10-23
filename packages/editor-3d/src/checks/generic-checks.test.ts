// The checks that need no profile, run together over a level's resolved sectors.
import { describe, expect, it } from 'vitest'
import { plainContext } from '../testing/check-context'
import { BLOCKOUT_NAMES, expandedBlockout } from '../testing/geometry-golden'
import { room, square } from '../testing/toy-sectors'
import { genericChecks } from './generic-checks'

describe('genericChecks', () => {
  it('answers shared-walls, openings, overlap and heights, in that order, each ok on a clean level', () => {
    const results = genericChecks(
      plainContext([room('a', square(0, 0, 4, 4)), room('b', square(4.125, 0, 8, 4))]),
    )
    expect(results.map((result) => [result.id, result.ok, result.severity, result.detail])).toEqual([
      ['shared-walls', true, 'error', 'ok'],
      ['openings', true, 'error', 'ok'],
      ['overlap', true, 'error', 'ok'],
      ['heights', true, 'error', 'ok'],
    ])
  })

  it('puts each problem in its own result, joined as Last Light joins them', () => {
    const results = genericChecks(
      plainContext([
        room('a', [
          [0, 0],
          [4, 0, { next: 'b' }],
          [4, 4],
          [0, 4],
        ]),
        room('b', square(4, 0, 8, 4), { floor: 5, ceiling: 4 }),
      ]),
    )
    const byId = Object.fromEntries(results.map((result) => [result.id, result]))
    expect(byId['shared-walls']?.ok).toBe(true)
    expect(byId.openings?.detail).toBe('a → b from (4, 0) to (4, 4) has no matching portal back')
    expect(byId.overlap?.ok).toBe(true)
    expect(byId.heights?.problems.map((problem) => problem.message)).toEqual([
      'b: the ceiling (4 m) is not above the floor (5 m)',
      'a and b: their portal at (4, 2) leaves no opening (the higher floor is 5 m, the lower ceiling 3 m)',
    ])
  })

  for (const name of BLOCKOUT_NAMES) {
    it(`${name}: passes all four`, () => {
      const expanded = expandedBlockout(name)
      const results = genericChecks(plainContext(expanded.sectors, expanded.masses))
      expect(
        results.filter((result) => !result.ok).map((result) => `${result.id}: ${result.detail}`),
      ).toEqual([])
    })
  }
})

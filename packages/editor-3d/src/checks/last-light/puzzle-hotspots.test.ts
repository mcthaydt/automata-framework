// Last Light's `puzzleHotspots` check (scripts/pipeline/blockout-lib.ts, 92e6704): every hotspot the scene's puzzle acts
// on is placed in the level. The list comes from the caller: the puzzle is not part of the blockout file.
import { describe, expect, it } from 'vitest'
import { expand } from '../../format/expand'
import { toyBlockout } from '../../testing/toy-blockout'
import { puzzleHotspotProblems } from './puzzle-hotspots'

const expanded = expand(
  toyBlockout({
    hotspots: [
      { id: 'far', x: 6, y: 1, z: 3, name: 'Far wall', reach: 1.4 },
      { id: 'near', x: 1, y: 1, z: 1, name: 'Near', reach: 1 },
    ],
  }),
)

describe('puzzleHotspotProblems', () => {
  it('passes a puzzle whose hotspots are all placed, and one with none', () => {
    expect(puzzleHotspotProblems(expanded, ['far', 'near'])).toEqual([])
    expect(puzzleHotspotProblems(expanded, [])).toEqual([])
  })

  it("fails each hotspot the level does not place, in the puzzle's order, with Last Light's sentence and no place", () => {
    const found = puzzleHotspotProblems(expanded, ['ghost', 'far', 'drum'])
    expect(found.map((problem) => problem.message)).toEqual([
      'puzzle hotspot ghost is not placed',
      'puzzle hotspot drum is not placed',
    ])
    expect(found.map((problem) => problem.locator)).toEqual([undefined, undefined])
  })

  it('has nothing to say when the level has no puzzle', () => {
    expect(puzzleHotspotProblems(expanded, null)).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import { encodeRows, packTile } from '#src/shared/level-2d/model/cells-codec.ts'
import { Grid } from '#src/shared/level-2d/model/grid.ts'
import { autoTiles, hashAutoTiles, patchAutoTiles } from '#src/shared/level-2d/tiles/autotile/auto-tiles.ts'
import { compileRules } from '#src/shared/level-2d/tiles/autotile/match.ts'
import { brushCells, lineCells } from '#src/shared/level-2d/tiles/footprint.ts'
import { hashText } from '#src/shared/level-2d/tiles/hash.ts'
import { paintCells, paintRandom } from '#src/shared/level-2d/tiles/paint.ts'
import { caveGrid, HILL, hillGrid, platformerRules } from '#src/testing/level-2d/autotile-fixtures.ts'

// The auto-tile goldens. This file runs in Node with the unit tests and again in Chromium,
// WebKit and Firefox (the `browsers` project), and the numbers below must be identical in all four: the rules, the
// dice and the map generator use integer arithmetic only. A mismatch is investigated, never re-recorded per engine.
// The numbers were recorded once from Node after the hand-worked hill in `platformer.test.ts` agreed with the engine.

const rows = (grid: Grid, kind: 'tile' | 'int'): string => encodeRows(grid, kind).join('\n')

describe('golden hashes', () => {
  const rules = compileRules(platformerRules())
  const cave = caveGrid()

  it('the generated cave is the same map everywhere', () => {
    expect(hashText(rows(cave, 'int'))).toBe(1954551494)
  })

  it.each([
    [1, 1604183895],
    [35229, 221764322],
    [4294967295, 13585030],
  ])('the cave under rule seed %i makes the same tiles', (seed, expected) => {
    expect(hashAutoTiles(autoTiles(cave, rules, seed))).toBe(expected)
  })

  it('the hand-worked hill makes the same tiles', () => {
    const result = autoTiles(hillGrid(), compileRules(platformerRules({ variation: false })), 1)
    expect(result.stacks.size).toBe(HILL.source.join('').replaceAll('.', '').length)
    // Also reproduced outside this code: a python murmur3 fold of the stacks written by hand in `HILL.expected`.
    expect(hashAutoTiles(result)).toBe(1551224868)
  })

  it('the dice paint the same tiles', () => {
    const candidates = [
      packTile(1, false, false),
      packTile(2, true, false),
      packTile(3, false, true),
      packTile(4, true, true),
    ]
    const grid = paintRandom(Grid.empty(32, 32), brushCells({ x: 16, y: 16 }, 8), candidates, 20261023)
    expect(hashText(rows(grid, 'tile'))).toBe(2698389805)
  })

  it('a painted stroke patches to the same tiles as a full evaluation, on every engine', () => {
    const stroke = lineCells({ x: 2, y: 4 }, { x: 40, y: 22 }).flatMap((at) => brushCells(at, 3))
    const painted = paintCells(cave, stroke, 1)
    const patched = patchAutoTiles(autoTiles(cave, rules, 35229), painted, rules, 35229, stroke)
    expect(hashAutoTiles(patched)).toBe(hashAutoTiles(autoTiles(painted, rules, 35229)))
  })
})

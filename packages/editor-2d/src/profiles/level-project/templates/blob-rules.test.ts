import { describe, expect, it } from 'vitest'
import { Grid } from '../../../model/grid'
import { compileRules, evaluateCell } from '../../../tiles/autotile/match'
import type { Rule } from '../../../tiles/autotile/rule.schema'
import { ruleIssues } from '../../../tiles/autotile/rule-issues'
import { blobRules, edgeRules } from './blob-rules'

// The eight neighbours of a cell, clockwise from north, as a bit each. A 3 × 3 source grid with the cell in the middle
// is every case a 3 × 3 rule can tell apart.
const AROUND: readonly [number, number][] = [
  [1, 0],
  [2, 0],
  [2, 1],
  [2, 2],
  [1, 2],
  [0, 2],
  [0, 1],
  [0, 0],
]

function neighbourhood(mask: number, solid: number, other: number): Grid {
  return Grid.empty(3, 3).edit((cells) => {
    cells.set(1, 1, solid)
    for (const [bit, [x, y]] of AROUND.entries()) cells.set(x, y, (mask >> bit) & 1 ? solid : other)
  })
}

/** How many of `rules` match the middle cell of `grid`, each tried alone so a `breakOnMatch` hides nothing. */
function matches(rules: readonly Rule[], grid: Grid): { rule: Rule; tile: number }[] {
  const found: { rule: Rule; tile: number }[] = []
  for (const rule of rules) {
    const group = { id: 'one', label: 'one', active: true, rules: [rule] }
    const stack = evaluateCell(grid, compileRules([group]), 1, 1, 1)
    for (const tile of stack) found.push({ rule, tile: tile.tile })
  }
  return found
}

describe('blobRules', () => {
  const rules = blobRules({ value: 1, firstTile: 0, idPrefix: 'ground' })

  it('is the 47-tile blob set: one rule for each neighbourhood a solid cell can tell apart', () => {
    expect(rules).toHaveLength(47)
    expect(new Set(rules.map((rule) => rule.id)).size).toBe(47)
    expect(rules.map((rule) => rule.tiles[0])).toEqual(Array.from({ length: 47 }, (_, i) => i))
  })

  it('matches exactly one rule for each of the 256 neighbourhoods, whatever the empty cells hold', () => {
    const used = new Set<number>()
    for (const other of [0, 2]) {
      for (let mask = 0; mask < 256; mask++) {
        const found = matches(rules, neighbourhood(mask, 1, other))
        expect(found, `mask ${mask}, others ${other}`).toHaveLength(1)
        used.add(found[0]?.tile ?? -1)
      }
    }
    expect(used.size).toBe(47)
  })

  it('draws an isolated cell, a cell in a solid mass and a straight top edge with the tiles it names', () => {
    const tileOf = (mask: number): number | undefined => matches(rules, neighbourhood(mask, 1, 0))[0]?.tile
    expect(tileOf(0)).toBe(0)
    expect(tileOf(0b11111111)).toBe(46)
    // North empty, the other seven solid: the cell has a top edge only.
    const top = tileOf(0b11111110)
    expect(top).toBeDefined()
    expect(top).not.toBe(46)
  })

  it('reads beyond the level as solid, so ground runs on past the edge', () => {
    const ground = Grid.empty(2, 2).edit((cells) => cells.fillRect(0, 0, 2, 2, 1))
    const group = { id: 'g', label: 'g', active: true, rules }
    const stack = evaluateCell(ground, compileRules([group]), 1, 0, 0)
    expect(stack.map((tile) => tile.tile)).toEqual([46])
  })

  it('offsets its tiles and uses its own value, and has no problem the rule checker can find', () => {
    const shifted = blobRules({ value: 3, firstTile: 10, idPrefix: 'rock' })
    expect(shifted.map((rule) => rule.tiles[0])).toEqual(Array.from({ length: 47 }, (_, i) => 10 + i))
    const group = { id: 'g', label: 'g', active: true, rules: shifted }
    expect(ruleIssues([group], { values: new Set([3]), tileCount: 57 })).toEqual([])
  })
})

describe('edgeRules', () => {
  const rules = edgeRules({ value: 1, firstTile: 8, idPrefix: 'wall' })

  it('is the 16-tile four-neighbour set, indexed by north 1, east 2, south 4, west 8', () => {
    expect(rules).toHaveLength(16)
    expect(new Set(rules.map((rule) => rule.id)).size).toBe(16)
    const fourOnly = (mask: number): Grid =>
      Grid.empty(3, 3).edit((cells) => {
        cells.set(1, 1, 1)
        if (mask & 1) cells.set(1, 0, 1)
        if (mask & 2) cells.set(2, 1, 1)
        if (mask & 4) cells.set(1, 2, 1)
        if (mask & 8) cells.set(0, 1, 1)
      })
    for (let mask = 0; mask < 16; mask++) {
      const found = matches(rules, fourOnly(mask))
      expect(found.map((match) => match.tile)).toEqual([8 + mask])
    }
  })

  it('matches one rule however the diagonals are filled', () => {
    for (let mask = 0; mask < 256; mask++) {
      expect(matches(rules, neighbourhood(mask, 1, 0))).toHaveLength(1)
    }
  })
})

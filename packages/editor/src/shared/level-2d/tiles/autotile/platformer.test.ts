import { describe, expect, it } from 'vitest'
import { caveGrid, HILL, hillGrid, platformerRules } from '../../../../testing/level-2d/autotile-fixtures'
import { autoTiles } from './auto-tiles'
import { compileRules, evaluateCell } from './match'
import { ruleIssues } from './rule-issues'

const text = (stack: readonly { tile: number; flipX: boolean; flipY: boolean }[]): string =>
  stack.map((t) => `${t.tile}${t.flipX ? 'h' : ''}${t.flipY ? 'v' : ''}`).join('+') || '.'

describe('the platformer rule set', () => {
  it('draws the hand-worked hill: corners, tops, inner corners and interior, as worked out by hand', () => {
    const grid = hillGrid()
    const rules = compileRules(platformerRules({ variation: false }))
    const rows: string[] = []
    for (let y = 0; y < grid.rows; y++) {
      const row: string[] = []
      for (let x = 0; x < grid.cols; x++) row.push(text(evaluateCell(grid, rules, 1, x, y)))
      rows.push(row.join(' '))
    }
    expect(rows).toEqual(HILL.expected)
  })

  it('has no problems of its own: every value and tile it names exists', () => {
    expect(ruleIssues(platformerRules(), { values: new Set([1, 2]), tileCount: 32 })).toEqual([])
  })

  it('makes a landscape with ground, water and holes, and a result that does not depend on the seed except by variation', () => {
    const cave = caveGrid()
    const values = new Set(cave.nonEmpty().map((cell) => cell.value))
    expect(values).toEqual(new Set([1, 2]))
    const plain = compileRules(platformerRules({ variation: false }))
    const one = autoTiles(cave, plain, 1)
    const two = autoTiles(cave, plain, 2)
    expect([...one.stacks]).toEqual([...two.stacks])
    expect(one.stacks.size).toBeGreaterThan(500)
  })

  it('varies with the seed when variation is on', () => {
    const rules = compileRules(platformerRules())
    const cave = caveGrid()
    const one = autoTiles(cave, rules, 1)
    const two = autoTiles(cave, rules, 2)
    expect([...one.stacks]).not.toEqual([...two.stacks])
  })
})

import { describe, expect, it } from 'vitest'
import type { Grid } from '../../model/grid'
import { intGridOf } from '../../testing/int-grid'
import { makeGroup, makeRule } from '../../testing/rules'
import { compileRules, evaluateCell } from './match'
import type { RuleGroup } from './rule.schema'

/** The stack at a cell as text: the tile index, then `h` for flipX and `v` for flipY; stacked tiles are joined by `+`. */
function stackAt(grid: Grid, groups: readonly RuleGroup[], x: number, y: number, seed = 1): string {
  return evaluateCell(grid, compileRules(groups), seed, x, y)
    .map((t) => `${t.tile}${t.flipX ? 'h' : ''}${t.flipY ? 'v' : ''}`)
    .join('+')
}

/** The whole layer as rows of cells: `.` where nothing is drawn. */
function stacksOf(grid: Grid, groups: readonly RuleGroup[], seed = 1): string[] {
  const rows: string[] = []
  for (let y = 0; y < grid.rows; y++) {
    const row: string[] = []
    for (let x = 0; x < grid.cols; x++) row.push(stackAt(grid, groups, x, y, seed) || '.')
    rows.push(row.join(' '))
  }
  return rows
}

const one = (...rules: ReturnType<typeof makeRule>[]): RuleGroup[] => [makeGroup('g', rules)]

describe('pattern cells', () => {
  const row = intGridOf('.125')
  const only = (pattern: string) => stacksOf(row, one(makeRule('r', [pattern], { tiles: [7] })))[0]

  it('any matches every value', () => expect(only('?')).toBe('7 7 7 7'))
  it('empty matches only 0', () => expect(only('.')).toBe('7 . . .'))
  it('filled matches any value but 0', () => expect(only('#')).toBe('. 7 7 7'))
  it('is matches exactly that value', () => expect(only('2')).toBe('. . 7 .'))
  it('not matches everything else, empty included', () => expect(only('b')).toBe('7 7 . 7'))
})

describe('window sizes', () => {
  it('size 3 reads the eight neighbours: filled with an empty cell above is a top edge', () => {
    const grid = intGridOf('...', '###', '###')
    const top = one(makeRule('top', ['?.?', '?#?', '???'], { tiles: [3] }))
    expect(stacksOf(grid, top)).toEqual(['. . .', '3 3 3', '. . .'])
  })

  it('size 3 reads corners', () => {
    const grid = intGridOf('.##', '###', '###')
    const corner = one(makeRule('inner', ['.??', '?#?', '???'], { tiles: [9], outside: 1 }))
    expect(stacksOf(grid, corner)).toEqual(['. . .', '. 9 .', '. . .'])
  })

  it('size 5 reads two cells away and no further', () => {
    // The centre has to be filled and the cell two up and two left has to be 1.
    const far = one(makeRule('far', ['1????', '?????', '??#??', '?????', '?????'], { tiles: [5] }))
    const hit = intGridOf('1......', '.......', '..1....', '.......', '.......', '.......', '......1')
    expect(stackAt(hit, far, 2, 2)).toBe('5')
    // The 1 is three cells away diagonally, which a 5 × 5 window does not reach.
    const tooFar = intGridOf('1......', '.......', '.......', '...1...', '.......', '.......', '.......')
    expect(stackAt(tooFar, far, 3, 3)).toBe('')
    expect(stackAt(tooFar, far, 2, 2)).toBe('')
  })

  it('size 1 looks at the cell alone', () => {
    expect(stacksOf(intGridOf('.1'), one(makeRule('solo', ['#'], { tiles: [2] })))).toEqual(['. 2'])
  })
})

describe('outside the level', () => {
  const full = intGridOf('111', '111', '111')
  // Each rule wants an empty neighbour on one side of a filled cell.
  const sides: Record<string, { rows: string[]; edge: string[] }> = {
    above: { rows: ['?.?', '?#?', '???'], edge: ['3 3 3', '. . .', '. . .'] },
    below: { rows: ['???', '?#?', '?.?'], edge: ['. . .', '. . .', '3 3 3'] },
    left: { rows: ['???', '.#?', '???'], edge: ['3 . .', '3 . .', '3 . .'] },
    right: { rows: ['???', '?#.', '???'], edge: ['. . 3', '. . 3', '. . 3'] },
    corner: { rows: ['.??', '?#?', '???'], edge: ['3 3 3', '3 . .', '3 . .'] },
  }

  for (const [name, { rows, edge }] of Object.entries(sides)) {
    it(`outside 0 reads empty beyond the ${name} edge`, () => {
      expect(stacksOf(full, one(makeRule('r', rows, { tiles: [3], outside: 0 })))).toEqual(edge)
    })
    it(`outside 1 (the same as the level) and 'same' match nothing beyond the ${name} edge`, () => {
      expect(stacksOf(full, one(makeRule('r', rows, { tiles: [3], outside: 1 })))).toEqual([
        '. . .',
        '. . .',
        '. . .',
      ])
      expect(stacksOf(full, one(makeRule('r', rows, { tiles: [3], outside: 'same' })))).toEqual([
        '. . .',
        '. . .',
        '. . .',
      ])
    })
  }

  it("'same' repeats the centre: an edge cell sees itself beyond the edge", () => {
    // Beyond the left edge the rule wants a 2: only 'same' on a cell that is itself 2 supplies one.
    const grid = intGridOf('22', '12')
    const rule = (outside: 0 | 'same') => one(makeRule('r', ['???', '2#?', '???'], { tiles: [4], outside }))
    expect(stacksOf(grid, rule('same'))).toEqual(['4 4', '. .'])
    expect(stacksOf(grid, rule(0))).toEqual(['. 4', '. .'])
  })

  it('a cell outside the level has no tiles', () => {
    const groups = one(makeRule('r', ['?']))
    expect(stackAt(intGridOf('1'), groups, -1, 0)).toBe('')
    expect(stackAt(intGridOf('1'), groups, 1, 0)).toBe('')
  })
})

describe('flips', () => {
  const leftEmpty = ['???', '.#?', '???']

  it('with flipX also tries the mirrored pattern and draws the tile mirrored', () => {
    const grid = intGridOf('##.')
    const rule = one(makeRule('r', leftEmpty, { tiles: [6], flipX: true }))
    // (0,0): left is beyond the edge, empty: plain. (1,0): left is filled, right is empty: mirrored.
    expect(stacksOf(grid, rule)).toEqual(['6 6h .'])
  })

  it('tries the plain pattern first, so a cell that matches both ways is not mirrored', () => {
    const rule = one(makeRule('r', leftEmpty, { tiles: [6], flipX: true }))
    expect(stacksOf(intGridOf('.#.'), rule)).toEqual(['. 6 .'])
  })

  it('without the flag the mirrored pattern is not tried', () => {
    expect(stacksOf(intGridOf('##.'), one(makeRule('r', leftEmpty, { tiles: [6] })))).toEqual(['6 . .'])
  })

  it('flipY mirrors up and down', () => {
    const above = ['?.?', '?#?', '???']
    const grid = intGridOf('#', '#', '.')
    // (0,0): above is beyond the edge: plain. (0,1): below is empty: mirrored vertically.
    expect(stacksOf(grid, one(makeRule('r', above, { tiles: [8], flipY: true })))).toEqual(['8', '8v', '.'])
  })

  it('with both flags tries none, X, Y and XY in that order', () => {
    const topLeftEmpty = ['.??', '?#?', '???']
    const rules = one(makeRule('r', topLeftEmpty, { tiles: [2], flipX: true, flipY: true }))
    const plain = intGridOf('.##', '###', '###')
    const x = intGridOf('##.', '###', '###')
    const y = intGridOf('###', '###', '.##')
    const xy = intGridOf('###', '###', '##.')
    expect(stackAt(plain, rules, 1, 1)).toBe('2')
    expect(stackAt(x, rules, 1, 1)).toBe('2h')
    expect(stackAt(y, rules, 1, 1)).toBe('2v')
    expect(stackAt(xy, rules, 1, 1)).toBe('2hv')
  })

  it('with only flipX the Y variant is not tried', () => {
    const rules = one(makeRule('r', ['.??', '?#?', '???'], { tiles: [2], flipX: true }))
    expect(stackAt(intGridOf('###', '###', '.##'), rules, 1, 1)).toBe('')
  })
})

describe('chance and variants', () => {
  const field = intGridOf(...Array.from({ length: 64 }, () => '1'.repeat(64)))
  const count = (rows: string[], tile: string): number =>
    rows
      .join(' ')
      .split(' ')
      .filter((t) => t === tile).length

  it('chance 1 always applies and 0 never does', () => {
    expect(count(stacksOf(field, one(makeRule('r', ['#'], { tiles: [1], chance: 1 }))), '1')).toBe(4096)
    expect(count(stacksOf(field, one(makeRule('r', ['#'], { tiles: [1], chance: 0 }))), '1')).toBe(0)
  })

  it('chance 0.5 applies to about half the cells, the same cells on every run, other cells under another seed', () => {
    const groups = one(makeRule('r', ['#'], { tiles: [1], chance: 0.5 }))
    const first = stacksOf(field, groups, 11)
    expect(Math.abs(count(first, '1') - 2048)).toBeLessThan(205)
    expect(stacksOf(field, groups, 11)).toEqual(first)
    expect(stacksOf(field, groups, 12)).not.toEqual(first)
  })

  it('more than one tile picks a variant: all are used, none other, each about a third', () => {
    const rows = stacksOf(field, one(makeRule('r', ['#'], { tiles: [10, 11, 12] })))
    const counts = ['10', '11', '12'].map((tile) => count(rows, tile))
    expect(counts.reduce((a, b) => a + b, 0)).toBe(4096)
    for (const n of counts) expect(Math.abs(n - 4096 / 3)).toBeLessThan(205)
  })

  it('two rules choose independently: the same cell can get variant 0 of one and 2 of the other', () => {
    const rules = one(
      makeRule('a', ['#'], { tiles: [10, 11, 12] }),
      makeRule('b', ['#'], { tiles: [20, 21, 22] }),
    )
    const joined = new Set(stacksOf(field, rules).join(' ').split(' '))
    expect(joined.size).toBeGreaterThan(5)
  })
})

describe('order, stacking and break', () => {
  const grid = intGridOf('11', '11')

  it('stacks the tiles of the matching rules in rule order, groups first', () => {
    const groups = [
      makeGroup('base', [makeRule('fill', ['#'], { tiles: [1] }), makeRule('shade', ['#'], { tiles: [2] })]),
      makeGroup('trim', [makeRule('edge', ['#'], { tiles: [3] })]),
    ]
    expect(stackAt(grid, groups, 0, 0)).toBe('1+2+3')
  })

  it('break on match ends the cell', () => {
    const groups = one(
      makeRule('fill', ['#'], { tiles: [1], breakOnMatch: true }),
      makeRule('never', ['#'], { tiles: [2] }),
    )
    expect(stackAt(grid, groups, 0, 0)).toBe('1')
  })

  it('a rule that fails its chance roll does not match, so it does not break', () => {
    const field = intGridOf(...Array.from({ length: 32 }, () => '1'.repeat(32)))
    const groups = one(
      makeRule('maybe', ['#'], { tiles: [1], chance: 0.5, breakOnMatch: true }),
      makeRule('always', ['#'], { tiles: [2] }),
    )
    const cells = stacksOf(field, groups).join(' ').split(' ')
    expect(new Set(cells)).toEqual(new Set(['1', '2']))
  })

  it('skips an inactive rule, every rule of an inactive group, and a rule with no tiles', () => {
    const groups = [
      makeGroup('on', [
        makeRule('off', ['#'], { tiles: [1], active: false }),
        makeRule('empty', ['#'], { tiles: [] }),
        makeRule('live', ['#'], { tiles: [3] }),
      ]),
      makeGroup('off', [makeRule('hidden', ['#'], { tiles: [4] })], false),
    ]
    expect(stackAt(grid, groups, 0, 0)).toBe('3')
  })

  it('a rule that is skipped does not stop the ones after it', () => {
    const groups = one(
      makeRule('off', ['#'], { tiles: [1], active: false, breakOnMatch: true }),
      makeRule('live', ['#'], { tiles: [2] }),
    )
    expect(stackAt(grid, groups, 1, 1)).toBe('2')
  })
})

describe('compileRules radius', () => {
  const radiusOf = (...rules: ReturnType<typeof makeRule>[]): number => compileRules(one(...rules)).radius

  it('is how far the rules read: 0 for a size-1 rule, 1 for a 3 × 3 neighbour, 2 for a 5 × 5 far cell', () => {
    expect(radiusOf(makeRule('a', ['#']))).toBe(0)
    expect(radiusOf(makeRule('a', ['?.?', '?#?', '???']))).toBe(1)
    expect(radiusOf(makeRule('a', ['?????', '?????', '??#??', '?????', '????1']))).toBe(2)
  })

  it('counts the cells a pattern really reads, not its size: a 5 × 5 of "any" around the centre reads nothing else', () => {
    expect(radiusOf(makeRule('a', ['?????', '?????', '??#??', '?????', '?????']))).toBe(0)
  })

  it('takes the largest of the rules, and flips reach no further', () => {
    expect(
      radiusOf(makeRule('a', ['#']), makeRule('b', ['?.?', '?#?', '???'], { flipX: true, flipY: true })),
    ).toBe(1)
  })

  it('leaves out rules that can never draw: inactive, no tiles, chance 0, or in an inactive group', () => {
    const far = ['????1', '?????', '??#??', '?????', '?????']
    const groups = [
      makeGroup('a', [
        makeRule('off', far, { active: false }),
        makeRule('none', far, { tiles: [] }),
        makeRule('never', far, { chance: 0 }),
        makeRule('near', ['#']),
      ]),
      makeGroup('b', [makeRule('hidden', far)], false),
    ]
    expect(compileRules(groups).radius).toBe(0)
    expect(compileRules(groups).rules).toHaveLength(1)
  })
})

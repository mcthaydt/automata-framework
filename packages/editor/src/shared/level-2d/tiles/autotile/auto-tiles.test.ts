import { describe, expect, it } from 'vitest'
import { intGridOf } from '../../../../testing/level-2d/int-grid'
import { type Random, seededRandom } from '../../../../testing/level-2d/random'
import { makeGroup, makeRule } from '../../../../testing/level-2d/rules'
import { packTile } from '../../model/cells-codec'
import { Grid } from '../../model/grid'
import {
  type AutoTiles,
  applyOverrides,
  autoTiles,
  hashAutoTiles,
  patchAutoTiles,
  windowAround,
} from './auto-tiles'
import { compileRules, evaluateCell } from './match'
import type { PatternCell, Rule, RuleGroup } from './rule.schema'

/** Entries as sorted text, so two results compare whatever order their maps were built in. */
function entriesOf(result: AutoTiles): string[] {
  return [...result.stacks]
    .sort(([a], [b]) => a - b)
    .map(
      ([key, stack]) =>
        `${key}:${stack.map((t) => `${t.tile}${t.flipX ? 'h' : ''}${t.flipY ? 'v' : ''}`).join('+')}`,
    )
}

const edge = [makeGroup('g', [makeRule('top', ['?.?', '?#?', '???'], { tiles: [3] })])]

describe('autoTiles', () => {
  it('has an entry, keyed y * cols + x, for each cell that draws something', () => {
    const grid = intGridOf('...', '###', '###')
    const result = autoTiles(grid, compileRules(edge), 1)
    expect(result.cols).toBe(3)
    expect(result.rows).toBe(3)
    expect(entriesOf(result)).toEqual(['3:3', '4:3', '5:3'])
  })

  it('agrees with evaluating each cell', () => {
    const grid = intGridOf('.##.', '####', '.##.')
    const compiled = compileRules([
      makeGroup('g', [
        makeRule('fill', ['#'], { tiles: [1, 2] }),
        makeRule('rim', ['?.?', '?#?', '???'], { tiles: [9] }),
      ]),
    ])
    const result = autoTiles(grid, compiled, 77)
    for (let y = 0; y < grid.rows; y++) {
      for (let x = 0; x < grid.cols; x++) {
        const stack = evaluateCell(grid, compiled, 77, x, y)
        expect(result.stacks.get(y * grid.cols + x) ?? [], `${x},${y}`).toEqual(stack)
      }
    }
  })

  it('is empty for an empty level or no rules', () => {
    expect(autoTiles(Grid.empty(4, 4), compileRules(edge), 1).stacks.size).toBe(0)
    expect(autoTiles(intGridOf('##'), compileRules([]), 1).stacks.size).toBe(0)
  })
})

describe('hashAutoTiles', () => {
  const build = (order: readonly number[]): AutoTiles => ({
    cols: 4,
    rows: 2,
    stacks: new Map(order.map((key) => [key, [{ tile: key, flipX: false, flipY: false }]] as const)),
  })

  it('does not depend on the order the map was built in', () => {
    expect(hashAutoTiles(build([1, 5, 6]))).toBe(hashAutoTiles(build([6, 1, 5])))
  })

  it('changes with the cell, the tile, the flips, the stack order and the size', () => {
    const base: AutoTiles = {
      cols: 4,
      rows: 2,
      stacks: new Map([[1, [{ tile: 3, flipX: false, flipY: false }]]]),
    }
    const hash = hashAutoTiles(base)
    const withStack = (stack: AutoTiles['stacks']): number => hashAutoTiles({ ...base, stacks: stack })
    expect(withStack(new Map([[2, [{ tile: 3, flipX: false, flipY: false }]]]))).not.toBe(hash)
    expect(withStack(new Map([[1, [{ tile: 4, flipX: false, flipY: false }]]]))).not.toBe(hash)
    expect(withStack(new Map([[1, [{ tile: 3, flipX: true, flipY: false }]]]))).not.toBe(hash)
    expect(withStack(new Map([[1, [{ tile: 3, flipX: false, flipY: true }]]]))).not.toBe(hash)
    expect(hashAutoTiles({ ...base, cols: 5 })).not.toBe(hash)
    const ab = [
      { tile: 1, flipX: false, flipY: false },
      { tile: 2, flipX: false, flipY: false },
    ]
    expect(withStack(new Map([[1, ab]]))).not.toBe(withStack(new Map([[1, [...ab].reverse()]])))
  })

  it('is an unsigned 32-bit integer', () => {
    const h = hashAutoTiles(build([1, 2, 3]))
    expect(Number.isInteger(h) && h >= 0 && h <= 0xffffffff).toBe(true)
  })
})

describe('windowAround', () => {
  it('is the changed cells themselves at radius 0, once each', () => {
    expect(
      windowAround(
        [
          { x: 2, y: 1 },
          { x: 2, y: 1 },
          { x: 0, y: 0 },
        ],
        0,
        4,
        4,
      ),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 1 },
    ])
  })

  it('reaches radius cells in every direction, clipped to the level, row by row', () => {
    expect(windowAround([{ x: 0, y: 0 }], 1, 4, 4)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ])
    expect(windowAround([{ x: 5, y: 5 }], 2, 10, 10)).toHaveLength(25)
  })

  it('merges overlapping windows and takes no cell twice', () => {
    const cells = windowAround(
      [
        { x: 3, y: 3 },
        { x: 4, y: 3 },
      ],
      1,
      10,
      10,
    )
    expect(cells).toHaveLength(12)
    expect(new Set(cells.map((c) => `${c.x},${c.y}`)).size).toBe(12)
  })

  it('is nothing for no change, and ignores cells that are not in the level', () => {
    expect(windowAround([], 2, 4, 4)).toEqual([])
    expect(windowAround([{ x: -9, y: 0 }], 1, 4, 4)).toEqual([])
  })
})

describe('patchAutoTiles', () => {
  const compiled = compileRules(edge)

  it('recomputes the cells around a change and keeps the rest of the previous result', () => {
    const before = intGridOf('....', '####', '####', '####')
    const previous = autoTiles(before, compiled, 5)
    const after = before.set(1, 2, 0)
    const patched = patchAutoTiles(previous, after, compiled, 5, [{ x: 1, y: 2 }])
    expect(entriesOf(patched)).toEqual(entriesOf(autoTiles(after, compiled, 5)))
    // (3,1) is outside the one-cell window around (1,2), so its stack is the very object from before.
    expect(patched.stacks.get(7)).toBe(previous.stacks.get(7))
    expect(patched.stacks.get(7)).toBeDefined()
    expect(patched).not.toBe(previous)
  })

  it('refuses a source whose size is not the previous result’s: that is a whole-layer job', () => {
    const previous = autoTiles(intGridOf('##'), compiled, 1)
    expect(() => patchAutoTiles(previous, intGridOf('###'), compiled, 1, [])).toThrow(RangeError)
  })

  it('equals a full evaluation after random edits, for random rules, groups, windows and seeds (property)', () => {
    const random = seededRandom(20261023)
    for (let run = 0; run < 300; run++) {
      const cols = 1 + random.int(20)
      const rows = 1 + random.int(20)
      let grid = Grid.empty(cols, rows)
      for (let i = 0; i < (cols * rows) / 2; i++)
        grid = grid.set(random.int(cols), random.int(rows), random.int(4))
      const rules = compileRules(randomGroups(random))
      const seed = random.next()
      const previous = autoTiles(grid, rules, seed)

      const changed = Array.from({ length: 1 + random.int(10) }, () => ({
        x: random.int(cols),
        y: random.int(rows),
      }))
      let edited = grid
      for (const { x, y } of changed) edited = edited.set(x, y, random.int(4))

      const patched = patchAutoTiles(previous, edited, rules, seed, changed)
      expect(entriesOf(patched), `run ${run}`).toEqual(entriesOf(autoTiles(edited, rules, seed)))
    }
  })
})

describe('applyOverrides', () => {
  const result = autoTiles(
    intGridOf('#.#'),
    compileRules([makeGroup('g', [makeRule('fill', ['#'], { tiles: [1] })])]),
    1,
  )

  it('replaces a cell’s stack with the one override tile, flips included, and leaves the other cells', () => {
    const overrides = Grid.empty(3, 1)
      .set(0, 0, packTile(8, true, false))
      .set(1, 0, packTile(9, false, true))
    const merged = applyOverrides(result, overrides)
    expect(entriesOf(merged)).toEqual(['0:8h', '1:9v', '2:1'])
  })

  it('does not change the result it was given', () => {
    applyOverrides(result, Grid.empty(3, 1).set(0, 0, packTile(8, false, false)))
    expect(entriesOf(result)).toEqual(['0:1', '2:1'])
  })

  it('is the same result when there is nothing to override, and ignores cells beyond the level', () => {
    expect(applyOverrides(result, Grid.empty(3, 1))).toBe(result)
    expect(entriesOf(applyOverrides(result, Grid.empty(6, 3).set(5, 2, packTile(1, false, false))))).toEqual(
      entriesOf(result),
    )
  })
})

const CELLS: readonly PatternCell[] = [
  'any',
  'any',
  'empty',
  'filled',
  { is: 1 },
  { is: 2 },
  { not: 1 },
  { not: 3 },
]

function randomRule(random: Random, id: string): Rule {
  const size = random.pick([1, 3, 5] as const)
  return {
    id,
    active: random.int(8) !== 0,
    size,
    pattern: Array.from({ length: size * size }, () => random.pick(CELLS)),
    tiles: Array.from({ length: random.int(4) }, () => random.int(10)),
    chance: random.pick([1, 1, 1, 0.5, 0.25]),
    flipX: random.int(3) === 0,
    flipY: random.int(3) === 0,
    breakOnMatch: random.int(4) === 0,
    outside: random.pick([0, 1, 2, 'same'] as const),
  }
}

function randomGroups(random: Random): RuleGroup[] {
  return Array.from({ length: 1 + random.int(3) }, (_, g) => ({
    id: `g${g}`,
    label: `g${g}`,
    active: random.int(6) !== 0,
    rules: Array.from({ length: 1 + random.int(4) }, (_, r) => randomRule(random, `g${g}-r${r}`)),
  }))
}

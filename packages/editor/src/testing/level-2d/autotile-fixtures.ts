import { Grid } from '../../shared/level-2d/model/grid'
import type { RuleGroup } from '../../shared/level-2d/tiles/autotile/rule.schema'
import { seededRandom } from './random'
import { makeGroup, makeRule } from './rules'

// The platformer rule set and cave map the auto-tile goldens run on (2D editor spec §14). Pattern characters are
// those of `rules.ts`: `1` is ground, `2` is water, `a` is "not ground", `?` is any. Every rule reads beyond the level
// edge as the cell itself (`outside: 'same'`), so ground runs on past the edge instead of ending in a wall.

/**
 * Three groups: the edges and fill of the ground (corners first, and each of those ends the cell, so a corner is not
 * also a top; a 5 × 5 deep-stone rule before the plain fill), decoration over the ground (grass tufts one cell in four),
 * and water.
 * `variation: false` leaves out the tuft and gives the fill and the water a single tile, so a hand-drawn map has one
 * right answer.
 */
export function platformerRules(options: { readonly variation?: boolean } = {}): RuleGroup[] {
  const variation = options.variation ?? true
  const same = { outside: 'same' } as const
  return [
    makeGroup('ground', [
      makeRule('outer-corner', ['?a?', 'a1?', '???'], {
        tiles: [16],
        flipX: true,
        flipY: true,
        breakOnMatch: true,
        ...same,
      }),
      makeRule('inner-corner', ['a1?', '11?', '???'], {
        tiles: [17],
        flipX: true,
        flipY: true,
        breakOnMatch: true,
        ...same,
      }),
      makeRule('top', ['?a?', '?1?', '???'], { tiles: [1], ...same }),
      makeRule('bottom', ['???', '?1?', '?a?'], { tiles: [9], breakOnMatch: true, ...same }),
      makeRule('side', ['???', 'a1?', '???'], { tiles: [2], flipX: true, breakOnMatch: true, ...same }),
      // Deep stone: two cells inside the ground, where a 5 × 5 window is all ground. It goes first and ends the cell,
      // because the plain fill below it matches wherever it does.
      makeRule('deep', ['11111', '11111', '11111', '11111', '11111'], {
        tiles: [8],
        breakOnMatch: true,
        ...same,
      }),
      makeRule('interior', ['111', '111', '111'], {
        tiles: variation ? [4, 5, 6] : [4],
        breakOnMatch: true,
        ...same,
      }),
    ]),
    makeGroup('decor', [
      ...(variation
        ? [makeRule('tuft', ['?a?', '?1?', '???'], { tiles: [12, 13], chance: 0.25, ...same })]
        : []),
    ]),
    makeGroup('water', [
      makeRule('water-top', ['?.?', '?2?', '???'], { tiles: [20], breakOnMatch: true }),
      makeRule('water', ['2'], { tiles: variation ? [21, 22] : [21] }),
    ]),
  ]
}

/** A 5 × 4 hill, drawn by hand, with the stacks `platformerRules({ variation: false })` makes of it, worked out by hand. */
export const HILL = {
  source: ['.....', '.111.', '11111', '11111'],
  expected: ['. . . . .', '. 16 1 16h .', '1 17 4 17h 1', '4 4 4 4 4'],
} as const

/** The hill as a grid (`.` empty, a digit that value). */
export function hillGrid(): Grid {
  const rows = HILL.source
  return Grid.empty(rows[0]?.length ?? 0, rows.length).edit((cells) => {
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (row[x] !== '.') cells.set(x, y, Number(row[x]))
    })
  })
}

/**
 * A 48 × 32 landscape from a seeded generator (integer arithmetic only, so it is the same map on every engine): a
 * ground line that steps up and down every few columns, a pool, a floating platform, and holes in the ground. Water
 * fills the pool up to row 21.
 */
export function caveGrid(): Grid {
  const cols = 48
  const rows = 32
  const random = seededRandom(42)
  const surface: number[] = []
  let height = 18
  for (let x = 0; x < cols; x++) {
    if (x % 4 === 0) height = Math.min(20, Math.max(10, height + random.int(5) - 2))
    // A pool: the ground dips to row 25 for eight columns.
    surface.push(x >= 20 && x < 28 ? 25 : height)
  }
  return Grid.empty(cols, rows).edit((cells) => {
    for (let x = 0; x < cols; x++) {
      for (let y = 0; y < rows; y++) {
        const top = surface[x] as number
        if (y >= top) {
          const hole = y > top + 1 && random.int(9) === 0
          if (!hole) cells.set(x, y, 1)
        } else if (y >= 21) {
          cells.set(x, y, 2)
        }
      }
    }
    // A platform two cells thick, floating over the left half.
    for (let x = 6; x < 14; x++) for (const y of [8, 9]) cells.set(x, y, 1)
  })
}

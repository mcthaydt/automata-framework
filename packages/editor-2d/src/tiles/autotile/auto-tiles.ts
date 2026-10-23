import { unpackTile } from '../../model/cells-codec'
import type { Grid } from '../../model/grid'
import type { Point } from '../footprint'
import { hashCell } from '../hash'
import { type AutoTile, type CompiledRules, evaluateCell } from './match'

// The auto-tile result of a whole layer (2D editor spec §5.6): derived from the source IntGrid and the rules, never
// stored. `autoTiles` evaluates everything (opening a project, export); `patchAutoTiles` re-evaluates only the cells a
// change can reach (painting); the two are equal, which a property test checks on random rules and edits.

/** The tiles of an auto layer: `stacks` maps `y * cols + x` to the tiles drawn there, and has no entry for a bare cell. */
export interface AutoTiles {
  readonly cols: number
  readonly rows: number
  readonly stacks: ReadonlyMap<number, readonly AutoTile[]>
}

/** Every cell of the level, row by row. */
export function autoTiles(source: Grid, rules: CompiledRules, seed: number): AutoTiles {
  const stacks = new Map<number, readonly AutoTile[]>()
  for (let y = 0; y < source.rows; y++) {
    for (let x = 0; x < source.cols; x++) {
      const stack = evaluateCell(source, rules, seed, x, y)
      if (stack.length > 0) stacks.set(y * source.cols + x, stack)
    }
  }
  return { cols: source.cols, rows: source.rows, stacks }
}

/**
 * The cells whose tiles can change when `changed` source cells do: those within `radius` (`CompiledRules.radius`) of
 * any of them, clipped to the level, each once, row by row. A change of thousands of cells, such as a fill, is cheaper
 * as a whole-layer `autoTiles`.
 */
export function windowAround(changed: Iterable<Point>, radius: number, cols: number, rows: number): Point[] {
  const keys = new Set<number>()
  for (const { x, y } of changed) {
    if (x < 0 || y < 0 || x >= cols || y >= rows) continue
    for (let wy = Math.max(0, y - radius); wy <= Math.min(rows - 1, y + radius); wy++) {
      for (let wx = Math.max(0, x - radius); wx <= Math.min(cols - 1, x + radius); wx++)
        keys.add(wy * cols + wx)
    }
  }
  return [...keys].sort((a, b) => a - b).map((key) => ({ x: key % cols, y: Math.floor(key / cols) }))
}

/**
 * `previous` brought up to date with the `changed` cells of `source`: the cells within the rules' reach of a change are
 * re-evaluated and every other stack is carried over (the same array objects). `source` must be the same size as
 * `previous`; a resized level is a whole-layer job. Copies the map, which is fine for export and tests; the canvas
 * patches its sprites itself from `windowAround` and `evaluateCell`.
 */
export function patchAutoTiles(
  previous: AutoTiles,
  source: Grid,
  rules: CompiledRules,
  seed: number,
  changed: Iterable<Point>,
): AutoTiles {
  if (source.cols !== previous.cols || source.rows !== previous.rows)
    throw new RangeError(
      `the level is now ${source.cols} × ${source.rows}, not ${previous.cols} × ${previous.rows}: evaluate the whole layer`,
    )
  const stacks = new Map(previous.stacks)
  for (const { x, y } of windowAround(changed, rules.radius, source.cols, source.rows)) {
    const stack = evaluateCell(source, rules, seed, x, y)
    if (stack.length > 0) stacks.set(y * source.cols + x, stack)
    else stacks.delete(y * source.cols + x)
  }
  return { cols: source.cols, rows: source.rows, stacks }
}

/**
 * Manual tiles painted over the result: a cell with an override shows that one tile (with its flips) instead of its
 * stack. Override cells beyond the level are ignored. The same result comes back when there is nothing to override.
 */
export function applyOverrides(result: AutoTiles, overrides: Grid): AutoTiles {
  const painted = overrides.nonEmpty().filter(({ x, y }) => x < result.cols && y < result.rows)
  if (painted.length === 0) return result
  const stacks = new Map(result.stacks)
  for (const { x, y, value } of painted) {
    const tile = unpackTile(value)
    if (tile) stacks.set(y * result.cols + x, [tile])
  }
  return { cols: result.cols, rows: result.rows, stacks }
}

/**
 * One unsigned 32-bit number for a result, for the golden tests: the size, then each cell in ascending order with each
 * tile of its stack, folded with the same integer hash as the rules. It does not depend on how the map was built.
 */
export function hashAutoTiles(result: AutoTiles): number {
  let h = hashCell(0, result.cols, result.rows, result.stacks.size, 0)
  for (const key of [...result.stacks.keys()].sort((a, b) => a - b)) {
    const stack = result.stacks.get(key) as readonly AutoTile[]
    stack.forEach((tile, index) => {
      h = hashCell(h, key, index, tile.tile, (tile.flipX ? 1 : 0) + (tile.flipY ? 2 : 0))
    })
  }
  return h
}

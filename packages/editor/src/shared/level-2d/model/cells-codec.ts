// Cell packing and the run-length row strings of the working file.
//
// A row prints as tokens separated by one space: `.` is an empty cell, an IntGrid cell is its value (1 to 255), a
// tile cell is the tile index followed by `h`, `v` or `hv` for the flips, and `*n` repeats a token n times:
// `.*5 7h*3 2.*24`. The printer is canonical (maximal runs, one spelling), so equal grids print byte-equal and a
// git diff shows only the rows that changed.

import { Grid } from './grid'

export type CellKind = 'tile' | 'int'

const TILE_MASK = 0x1fffffff
const FLIP_X = 0x40000000
const FLIP_Y = 0x80000000
const UNUSED_BIT = 0x20000000
/** The largest tile index: `tile + 1` has to fit the 29 low bits. */
const MAX_TILE = TILE_MASK - 1
const MAX_INT_VALUE = 255
/** Problems reported before a decode stops listing them. */
const MAX_PROBLEMS = 100

export interface UnpackedTile {
  readonly tile: number
  readonly flipX: boolean
  readonly flipY: boolean
}

/** A tile cell: `tile + 1` in bits 0 to 28 (so 0 stays empty), `flipX` in bit 30 and `flipY` in bit 31. */
export function packTile(tile: number, flipX: boolean, flipY: boolean): number {
  if (!Number.isInteger(tile) || tile < 0 || tile > MAX_TILE)
    throw new RangeError(`tile index ${tile} is out of range`)
  return tile + 1 + (flipX ? FLIP_X : 0) + (flipY ? FLIP_Y : 0)
}

/** The tile in a cell, or `undefined` for an empty one. A cell with bit 29 set, or flips and no tile, is not a tile cell. */
export function unpackTile(cell: number): UnpackedTile | undefined {
  if (cell === 0) return undefined
  const low = cell & TILE_MASK
  if ((cell & UNUSED_BIT) !== 0 || low === 0) throw new RangeError(`cell ${cell} is not a tile cell`)
  return { tile: low - 1, flipX: (cell & FLIP_X) !== 0, flipY: (cell & FLIP_Y) !== 0 }
}

function tokenOf(cell: number, kind: CellKind): string {
  if (cell === 0) return '.'
  if (kind === 'int') {
    if (cell > MAX_INT_VALUE) throw new RangeError(`IntGrid value ${cell} is out of range`)
    return String(cell)
  }
  const unpacked = unpackTile(cell)
  if (!unpacked) return '.'
  const flips = unpacked.flipX ? (unpacked.flipY ? 'hv' : 'h') : unpacked.flipY ? 'v' : ''
  return `${unpacked.tile}${flips}`
}

/** One canonical string per row: maximal runs of equal cells, `*n` only when n is at least 2. */
export function encodeRows(grid: Grid, kind: CellKind): string[] {
  const rows: string[] = []
  for (let y = 0; y < grid.rows; y++) {
    const tokens: string[] = []
    let x = 0
    while (x < grid.cols) {
      const cell = grid.get(x, y)
      let end = x + 1
      while (end < grid.cols && grid.get(end, y) === cell) end++
      const token = tokenOf(cell, kind)
      tokens.push(end - x > 1 ? `${token}*${end - x}` : token)
      x = end
    }
    rows.push(tokens.join(' '))
  }
  return rows
}

export interface CellProblem {
  /** The row index, or for a wrong row count the number of rows found. */
  readonly row: number
  /** The token index in the row, when one token is at fault. */
  readonly token?: number
  readonly message: string
}

export type DecodeRowsResult =
  | { readonly ok: true; readonly grid: Grid }
  | { readonly ok: false; readonly problems: CellProblem[] }

interface Token {
  readonly value: number
  readonly count: number
}

/** A token's cell value and repeat count, or a message saying why it is not a cell of this kind. */
function parseToken(text: string, kind: CellKind): Token | string {
  let base = text
  let count = 1
  const star = text.indexOf('*')
  if (star !== -1) {
    base = text.slice(0, star)
    const countText = text.slice(star + 1)
    if (!/^[1-9]\d*$/.test(countText)) return `"${text}" has a bad repeat count`
    count = Number(countText)
  }
  if (base === '.') return { value: 0, count }
  if (kind === 'int') {
    if (!/^\d+$/.test(base)) return `"${text}" is not an IntGrid value`
    const value = Number(base)
    if (value < 1 || value > MAX_INT_VALUE)
      return `"${text}": an IntGrid value is 1 to ${MAX_INT_VALUE} (empty is ".")`
    return { value, count }
  }
  const match = /^(\d+)(hv|h|v)?$/.exec(base)
  if (!match) return `"${text}" is not a tile cell`
  const tile = Number(match[1])
  if (tile > MAX_TILE) return `"${text}": tile index is too large`
  const flips = match[2] ?? ''
  return { value: packTile(tile, flips.includes('h'), flips.includes('v')), count }
}

interface Run {
  readonly x: number
  readonly y: number
  readonly length: number
  readonly value: number
}

/** Appends the non-empty runs of one row to `runs`; the problem with the row, if it has one. */
function readRow(
  text: string,
  y: number,
  kind: CellKind,
  cols: number,
  runs: Run[],
): CellProblem | undefined {
  const trimmed = text.trim()
  const tokens = trimmed === '' ? [] : trimmed.split(/\s+/)
  let x = 0
  for (const [index, tokenText] of tokens.entries()) {
    const token = parseToken(tokenText, kind)
    if (typeof token === 'string')
      return { row: y, token: index, message: `row ${y}, token ${index}: ${token}` }
    if (x + token.count > cols)
      return { row: y, token: index, message: `row ${y} is wider than ${cols} cells` }
    if (token.value !== 0) runs.push({ x, y, length: token.count, value: token.value })
    x += token.count
  }
  return x < cols ? { row: y, message: `row ${y} has ${x} cells, expected ${cols}` } : undefined
}

/**
 * Reads row strings into a grid of `cols` × `rowCount`. Every row that does not decode is reported with its position;
 * a repeat count is checked against the width before anything is expanded, so a hostile file costs nothing.
 */
export function decodeRows(
  rows: readonly string[],
  kind: CellKind,
  cols: number,
  rowCount: number,
): DecodeRowsResult {
  const problems: CellProblem[] = []
  const fail = (problem: CellProblem): void => {
    if (problems.length < MAX_PROBLEMS) problems.push(problem)
  }
  if (rows.length !== rowCount) {
    fail({ row: rows.length, message: `expected ${rowCount} rows, found ${rows.length}` })
  }

  const runs: Run[] = []
  for (let y = 0; y < Math.min(rows.length, rowCount); y++) {
    const problem = readRow(rows[y] ?? '', y, kind, cols, runs)
    if (problem) fail(problem)
  }

  if (problems.length > 0) return { ok: false, problems }
  const grid = Grid.empty(cols, rowCount).edit((cells) => {
    for (const run of runs) cells.fillRect(run.x, run.y, run.length, 1, run.value)
  })
  return { ok: true, grid }
}

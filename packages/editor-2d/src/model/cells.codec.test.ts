import { describe, expect, test } from 'vitest'
import { decodeRows, encodeRows, packTile, unpackTile } from './cells.codec'
import { Grid } from './grid'

const decodeOk = (rows: string[], kind: 'tile' | 'int', cols: number): Grid => {
  const result = decodeRows(rows, kind, cols, rows.length)
  if (!result.ok) throw new Error(result.problems.map((problem) => problem.message).join('; '))
  return result.grid
}

describe('tile cells', () => {
  test('pack tile + 1 in the low bits and the flips in bits 30 and 31', () => {
    expect(packTile(0, false, false)).toBe(1)
    expect(packTile(6, true, false)).toBe(7 + 0x40000000)
    expect(packTile(6, false, true)).toBe(7 + 0x80000000)
    expect(packTile(6, true, true)).toBe(7 + 0xc0000000)
  })

  test('unpack is the inverse of pack', () => {
    for (const [tile, flipX, flipY] of [
      [0, false, false],
      [123, true, false],
      [(1 << 29) - 2, false, true],
      [9, true, true],
    ] as const) {
      expect(unpackTile(packTile(tile, flipX, flipY))).toEqual({ tile, flipX, flipY })
    }
  })

  test('an empty cell has no tile', () => {
    expect(unpackTile(0)).toBeUndefined()
  })

  test('refuses a tile index that does not fit 29 bits', () => {
    expect(() => packTile(1 << 29, false, false)).toThrow(RangeError)
    expect(() => packTile(-1, false, false)).toThrow(RangeError)
  })
})

describe('encodeRows and decodeRows', () => {
  test('the spec example: five empty, a tile 7 flipped across three cells, tile 2, twenty-four empty', () => {
    const grid = decodeOk(['.*5 7h*3 2 .*24'], 'tile', 33)
    expect(grid.get(4, 0)).toBe(0)
    expect(grid.get(5, 0)).toBe(packTile(7, true, false))
    expect(grid.get(7, 0)).toBe(packTile(7, true, false))
    expect(grid.get(8, 0)).toBe(packTile(2, false, false))
    expect(encodeRows(grid, 'tile')).toEqual(['.*5 7h*3 2 .*24'])
  })

  test('an IntGrid row is values 1 to 255 and empties', () => {
    const grid = decodeOk(['. 1*3 . 255'], 'int', 6)
    expect([0, 1, 2, 3, 4, 5].map((x) => grid.get(x, 0))).toEqual([0, 1, 1, 1, 0, 255])
    expect(encodeRows(grid, 'int')).toEqual(['. 1*3 . 255'])
  })

  test('tile flips are h, v and hv', () => {
    const grid = decodeOk(['3 3h 3v 3hv'], 'tile', 4)
    expect([0, 1, 2, 3].map((x) => unpackTile(grid.get(x, 0)))).toEqual([
      { tile: 3, flipX: false, flipY: false },
      { tile: 3, flipX: true, flipY: false },
      { tile: 3, flipX: false, flipY: true },
      { tile: 3, flipX: true, flipY: true },
    ])
    expect(encodeRows(grid, 'tile')).toEqual(['3 3h 3v 3hv'])
  })

  test('an empty grid prints one run per row', () => {
    expect(encodeRows(Grid.empty(32, 3), 'int')).toEqual(['.*32', '.*32', '.*32'])
    expect(encodeRows(Grid.empty(1, 2), 'tile')).toEqual(['.', '.'])
  })

  test('a run of one has no repeat suffix and neighbours with different flips are not merged', () => {
    const grid = Grid.empty(5, 1)
      .set(0, 0, packTile(1, false, false))
      .set(1, 0, packTile(1, false, false))
      .set(2, 0, packTile(1, true, false))
    expect(encodeRows(grid, 'tile')).toEqual(['1*2 1h .*2'])
  })

  test('a grid with no columns prints and reads empty rows', () => {
    expect(encodeRows(Grid.empty(0, 2), 'int')).toEqual(['', ''])
    expect(decodeOk(['', ''], 'int', 0).cols).toBe(0)
  })

  test('reads *1, extra spaces and leading zeros, and prints them canonically', () => {
    const grid = decodeOk(['  .*1   07h*2  .  '], 'tile', 4)
    expect(encodeRows(grid, 'tile')).toEqual(['. 7h*2 .'])
  })

  test('reports each malformed token with its row and token position', () => {
    const cases: [string, string][] = [
      ['7x', 'tile'],
      ['vh', 'tile'],
      ['.h', 'tile'],
      ['.*', 'tile'],
      ['*3', 'tile'],
      ['7*0', 'tile'],
      ['7**2', 'tile'],
      ['-1', 'tile'],
      ['1.5', 'tile'],
      ['536870911', 'tile'],
      ['0', 'int'],
      ['256', 'int'],
      ['1h', 'int'],
    ]
    for (const [token, kind] of cases) {
      const result = decodeRows(['. ' + token], kind as 'tile' | 'int', 2, 1)
      expect(result.ok, token).toBe(false)
      if (!result.ok) expect(result.problems[0], token).toMatchObject({ row: 0, token: 1 })
    }
  })

  test('reports every bad row, not only the first', () => {
    const result = decodeRows(['.*2', '9x .', '. 0', '.*2'], 'int', 2, 4)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.problems.map((problem) => problem.row)).toEqual([1, 2])
  })

  test('a row that is too short or too wide is a problem with the counts', () => {
    const short = decodeRows(['.*3'], 'int', 4, 1)
    const wide = decodeRows(['.*5'], 'int', 4, 1)
    for (const result of [short, wide]) {
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.problems[0]).toMatchObject({ row: 0 })
    }
    if (!short.ok) expect(short.problems[0]?.message).toContain('3')
    if (!wide.ok) expect(wide.problems[0]?.message).toContain('4')
  })

  test('the wrong number of rows is a problem', () => {
    const result = decodeRows(['.*2', '.*2'], 'int', 2, 3)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.problems[0]?.message).toContain('3 rows')
  })

  test('a huge repeat count is refused without being expanded', () => {
    const result = decodeRows(['.*99999999999999'], 'int', 4, 1)
    expect(result.ok).toBe(false)
  })

  test('refuses to print a cell its kind cannot spell', () => {
    expect(() => encodeRows(Grid.empty(2, 1).set(0, 0, 256), 'int')).toThrow(RangeError)
    expect(() => encodeRows(Grid.empty(2, 1).set(0, 0, 0x20000001), 'tile')).toThrow(RangeError)
  })
})

describe('round trip over random grids', () => {
  // mulberry32: a small seeded generator, so the property is the same on every run and every engine.
  const generator = (seed: number): (() => number) => {
    let state = seed
    return () => {
      state = (state + 0x6d2b79f5) | 0
      let t = Math.imul(state ^ (state >>> 15), 1 | state)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  const randomGrid = (random: () => number, kind: 'tile' | 'int'): Grid => {
    const cols = 1 + Math.floor(random() * 40)
    const rows = 1 + Math.floor(random() * 20)
    const density = random()
    return Grid.empty(cols, rows).edit((cells) => {
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (random() > density) continue
          // Runs of equal cells are common in real levels; repeating the previous cell exercises `*n`.
          if (x > 0 && random() < 0.6) cells.set(x, y, cells.get(x - 1, y))
          else if (kind === 'int') cells.set(x, y, 1 + Math.floor(random() * 255))
          else cells.set(x, y, packTile(Math.floor(random() * 5000), random() < 0.3, random() < 0.3))
        }
      }
    })
  }

  for (const kind of ['tile', 'int'] as const) {
    test(`decode(encode(grid)) equals the grid, and encode(decode(rows)) is the same rows (${kind})`, () => {
      const random = generator(kind === 'tile' ? 7 : 11)
      for (let round = 0; round < 200; round++) {
        const grid = randomGrid(random, kind)
        const rows = encodeRows(grid, kind)
        const decoded = decodeRows(rows, kind, grid.cols, grid.rows)
        expect(decoded.ok).toBe(true)
        if (decoded.ok) {
          expect(decoded.grid.equals(grid)).toBe(true)
          expect(encodeRows(decoded.grid, kind)).toEqual(rows)
        }
      }
    })
  }
})

// The chunked immutable grid (2D editor spec §5.3, ED2D-D4): a sparse map of 16×16-cell chunks of `Uint32Array`.
// Every edit returns a new `Grid` that shares each chunk it did not touch, so a `History` snapshot costs only the
// chunks a stroke changed, and an undo is a reference swap. A chunk that is all zero is not stored, so an empty
// level costs nothing and two grids with the same cells have the same chunk keys (which `equals` relies on).
// Invariant: a cell outside `cols` × `rows` is always zero.

/** Cells along one side of a chunk. */
export const CHUNK = 16
const CHUNK_CELLS = CHUNK * CHUNK
const MAX_CELL = 0xffffffff

/** A grid being edited: writes are applied in place on private copies of the chunks they touch. */
export interface GridEditor {
  get(x: number, y: number): number
  set(x: number, y: number, value: number): void
  fillRect(x: number, y: number, w: number, h: number, value: number): void
}

const isWhole = (n: number): boolean => Number.isInteger(n) && n >= 0

const isAllZero = (chunk: Uint32Array): boolean => {
  for (const cell of chunk) if (cell !== 0) return false
  return true
}

export class Grid {
  readonly cols: number
  readonly rows: number
  readonly #chunks: ReadonlyMap<number, Uint32Array>
  readonly #chunkCols: number

  private constructor(cols: number, rows: number, chunks: ReadonlyMap<number, Uint32Array>) {
    this.cols = cols
    this.rows = rows
    this.#chunks = chunks
    this.#chunkCols = Math.ceil(cols / CHUNK)
  }

  static empty(cols: number, rows: number): Grid {
    if (!isWhole(cols) || !isWhole(rows))
      throw new RangeError(`grid size must be whole and not negative: ${cols} × ${rows}`)
    return new Grid(cols, rows, new Map())
  }

  /** Chunks that hold at least one non-zero cell. */
  get chunkCount(): number {
    return this.#chunks.size
  }

  get(x: number, y: number): number {
    if (!this.#inside(x, y)) return 0
    const chunk = this.#chunks.get(this.#chunkKey(x, y))
    return chunk ? (chunk[chunkOffset(x, y)] ?? 0) : 0
  }

  /** The same grid when the cell already holds `value` or (x, y) is outside. */
  set(x: number, y: number, value: number): Grid {
    return this.edit((cells) => cells.set(x, y, value))
  }

  /** `value` in every cell of the rectangle, clipped to the grid. The same grid when nothing changes. */
  fillRect(x: number, y: number, w: number, h: number, value: number): Grid {
    return this.edit((cells) => cells.fillRect(x, y, w, h, value))
  }

  /** Many writes at once: each touched chunk is copied once, however many cells change in it. */
  edit(fn: (cells: GridEditor) => void): Grid {
    const working = new Map(this.#chunks)
    const copied = new Set<number>()
    let changed = false

    const writable = (key: number): Uint32Array => {
      let chunk = working.get(key)
      if (!chunk) {
        chunk = new Uint32Array(CHUNK_CELLS)
        working.set(key, chunk)
        copied.add(key)
      } else if (!copied.has(key)) {
        chunk = chunk.slice()
        working.set(key, chunk)
        copied.add(key)
      }
      return chunk
    }

    const setCell = (x: number, y: number, value: number): void => {
      if (!Number.isInteger(value) || value < 0 || value > MAX_CELL) {
        throw new RangeError(`a cell holds an unsigned 32-bit integer, not ${value}`)
      }
      if (!this.#inside(x, y)) return
      const key = this.#chunkKey(x, y)
      const current = working.get(key)?.[chunkOffset(x, y)] ?? 0
      if (current === value) return
      writable(key)[chunkOffset(x, y)] = value
      changed = true
    }

    fn({
      get: (x, y) => (this.#inside(x, y) ? (working.get(this.#chunkKey(x, y))?.[chunkOffset(x, y)] ?? 0) : 0),
      set: setCell,
      fillRect: (x, y, w, h, value) => {
        const x1 = Math.min(x + w, this.cols)
        const y1 = Math.min(y + h, this.rows)
        for (let cy = Math.max(y, 0); cy < y1; cy++)
          for (let cx = Math.max(x, 0); cx < x1; cx++) setCell(cx, cy, value)
      },
    })

    if (!changed) return this
    for (const key of copied) {
      const chunk = working.get(key)
      if (chunk && isAllZero(chunk)) working.delete(key)
    }
    return new Grid(this.cols, this.rows, working)
  }

  /** The grid at another size; cells outside the new size are dropped. Whole chunks that stay inside are shared. */
  resize(cols: number, rows: number): Grid {
    if (!isWhole(cols) || !isWhole(rows))
      throw new RangeError(`grid size must be whole and not negative: ${cols} × ${rows}`)
    const chunks = new Map<number, Uint32Array>()
    const chunkCols = Math.ceil(cols / CHUNK)
    for (const [key, chunk] of this.#chunks) {
      const cx = key % this.#chunkCols
      const cy = Math.floor(key / this.#chunkCols)
      if (cx * CHUNK >= cols || cy * CHUNK >= rows) continue
      const fits = (cx + 1) * CHUNK <= cols && (cy + 1) * CHUNK <= rows
      const kept = fits ? chunk : maskChunk(chunk, cols - cx * CHUNK, rows - cy * CHUNK)
      if (kept) chunks.set(cy * chunkCols + cx, kept)
    }
    return new Grid(cols, rows, chunks)
  }

  equals(other: Grid): boolean {
    if (this.cols !== other.cols || this.rows !== other.rows || this.#chunks.size !== other.#chunks.size)
      return false
    for (const [key, chunk] of this.#chunks) {
      const theirs = other.#chunks.get(key)
      if (!theirs) return false
      for (let i = 0; i < CHUNK_CELLS; i++) if (chunk[i] !== theirs[i]) return false
    }
    return true
  }

  /** Every non-zero cell in row-major order. */
  nonEmpty(): readonly { readonly x: number; readonly y: number; readonly value: number }[] {
    const cells: { x: number; y: number; value: number }[] = []
    for (const [key, chunk] of this.#chunks) {
      const originX = (key % this.#chunkCols) * CHUNK
      const originY = Math.floor(key / this.#chunkCols) * CHUNK
      for (let i = 0; i < CHUNK_CELLS; i++) {
        const value = chunk[i] ?? 0
        if (value !== 0) cells.push({ x: originX + (i % CHUNK), y: originY + Math.floor(i / CHUNK), value })
      }
    }
    return cells.sort((a, b) => a.y - b.y || a.x - b.x)
  }

  /** Whether both grids hold the very same chunk object for the chunk containing (x, y): the sharing tests read this. */
  sharesChunk(other: Grid, x: number, y: number): boolean {
    const mine = this.#chunks.get(this.#chunkKey(x, y))
    return mine !== undefined && mine === other.#chunks.get(other.#chunkKey(x, y))
  }

  #inside(x: number, y: number): boolean {
    return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < this.cols && y < this.rows
  }

  #chunkKey(x: number, y: number): number {
    return Math.floor(y / CHUNK) * this.#chunkCols + Math.floor(x / CHUNK)
  }
}

const chunkOffset = (x: number, y: number): number => (y % CHUNK) * CHUNK + (x % CHUNK)

/** A copy of the chunk with every cell at or beyond `usableCols` or `usableRows` zeroed, or `undefined` if none is left. */
function maskChunk(chunk: Uint32Array, usableCols: number, usableRows: number): Uint32Array | undefined {
  const masked = chunk.slice()
  for (let i = 0; i < CHUNK_CELLS; i++) {
    if (i % CHUNK >= usableCols || Math.floor(i / CHUNK) >= usableRows) masked[i] = 0
  }
  return isAllZero(masked) ? undefined : masked
}

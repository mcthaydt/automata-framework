// Painted cells, kept by key up to a byte budget, the least recently used going first. The cells a frame shows are
// held, and eviction skips them, so a full cache never drops a cell that is on the screen.

import type { PaintedCell } from '../paint/paint-cell.ts'

/** The bytes a cell holds: its colours, normal map, depth and materials. */
export const cellBytes = (cell: PaintedCell): number =>
  cell.colours.byteLength + cell.normals.byteLength + cell.depth.byteLength + cell.material.byteLength

export class CellCache {
  private readonly cells = new Map<string, PaintedCell>()
  private held: ReadonlySet<string> = new Set()
  private used = 0

  constructor(private readonly capBytes: number) {}

  /** The bytes the cache holds now. */
  get bytes(): number {
    return this.used
  }

  get(key: string): PaintedCell | undefined {
    const cell = this.cells.get(key)
    if (cell === undefined) return undefined
    // Most recently used goes last.
    this.cells.delete(key)
    this.cells.set(key, cell)
    return cell
  }

  put(key: string, cell: PaintedCell): void {
    const old = this.cells.get(key)
    if (old !== undefined) this.used -= cellBytes(old)
    this.cells.delete(key)
    this.cells.set(key, cell)
    this.used += cellBytes(cell)
    for (const [k, c] of this.cells) {
      if (this.used <= this.capBytes) break
      if (k === key || this.held.has(k)) continue
      this.cells.delete(k)
      this.used -= cellBytes(c)
    }
  }

  /** Marks the cells this frame shows; eviction skips them until the next call. */
  hold(keys: Iterable<string>): void {
    this.held = new Set(keys)
  }
}

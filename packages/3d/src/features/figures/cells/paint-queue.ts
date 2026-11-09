// The cells a frame wants and has not got, painted one a frame, the most wanted first (a lower priority is wanted
// sooner), so a frame that needs forty new cells paints them over forty frames and not in one. A key is asked for once.

import type { PaintedCell } from './../paint/paint-cell.ts'

interface Request {
  readonly key: string
  readonly priority: number
  readonly paint: () => PaintedCell
}

export class PaintQueue {
  private readonly requests = new Map<string, Request>()

  /** `done` takes each cell as it is painted. */
  constructor(private readonly done: (key: string, cell: PaintedCell) => void = () => {}) {}

  get pending(): number {
    return this.requests.size
  }

  request(key: string, priority: number, paint: () => PaintedCell): void {
    const have = this.requests.get(key)
    if (have !== undefined && have.priority <= priority) return
    this.requests.set(key, { key, priority, paint })
  }

  /** Paints the most wanted cell, or none when nothing waits; returns its key. */
  runOne(): string | undefined {
    let best: Request | undefined
    for (const r of this.requests.values()) if (best === undefined || r.priority < best.priority) best = r
    if (best === undefined) return undefined
    this.requests.delete(best.key)
    this.done(best.key, best.paint())
    return best.key
  }
}

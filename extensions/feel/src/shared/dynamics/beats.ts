// Events held until the drawn picture reaches them. The sim runs ahead
// of the picture, so an event answered on arrival would land before the picture showed its cause. Each event is answered
// once: a batch delivered twice (a reconnect, a lagged tab catching up) starts nothing twice.
import type { SimEvent } from '@automata/sim'

/** How far behind the drawn tick a batch is remembered, to refuse a late replay; then it is forgotten. */
const MEMORY_TICKS = 600
/** How far behind the drawn tick an event may still be answered: half a second at 60 Hz. */
const STALE_TICKS = 30

/** A sim event with the tick that produced it. */
export interface Beat {
  readonly tick: number
  readonly event: SimEvent
}
/** How late an event may still be answered, in ticks behind the picture. */
export interface BeatsOptions {
  /** The most ticks behind the picture an event is still answered (default 30). */
  readonly staleTicks?: number | undefined
}

/**
 * Events held until the drawn picture reaches them, each answered once even when a batch is
 * delivered twice.
 */
export class Beats {
  private pending: Beat[] = []
  private readonly seen = new Set<string>()
  private readonly seenAt = new Map<string, number>()
  private readonly stale: number

  constructor(options: BeatsOptions = {}) {
    this.stale = options.staleTicks ?? STALE_TICKS
  }

  /** Notes the events a step at `tick` produced. An event is told apart by its tick and place in the batch. */
  noteAt(tick: number, events: readonly SimEvent[]): void {
    events.forEach((event, i) => {
      const id = `${tick}#${i}:${event.type}`
      if (this.seen.has(id)) return
      this.seen.add(id)
      this.seenAt.set(id, tick)
      this.pending.push({ tick, event })
    })
  }

  /**
   * The events the drawn tick has reached, oldest first; each is given once. One the picture passed more than the stale
   * window ago is dropped unanswered: a tab back from the background would otherwise play every pop it missed in one frame.
   */
  reach(drawnTick: number): Beat[] {
    if (this.pending.length === 0) return []
    const due = this.pending
      .filter((b) => b.tick <= drawnTick && b.tick >= drawnTick - this.stale)
      .sort((a, b) => a.tick - b.tick)
    this.pending = this.pending.filter((b) => b.tick > drawnTick)
    for (const [id, tick] of this.seenAt)
      if (tick < drawnTick - MEMORY_TICKS) {
        this.seenAt.delete(id)
        this.seen.delete(id)
      }
    return due
  }

  /** Batches still remembered. */
  get remembered(): number {
    return this.seen.size
  }

  clear(): void {
    this.pending = []
    this.seen.clear()
    this.seenAt.clear()
  }
}

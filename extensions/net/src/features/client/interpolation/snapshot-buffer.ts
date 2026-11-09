/**
 * Remote interpolation, over a view the game reads from each authoritative state.
 *
 * Authority arrives at the snapshot rate while the screen draws at the display rate, so remote entities are drawn a little behind
 * the newest snapshot, interpolated between the pair that brackets the render moment. Holding a delay is what turns a 20 Hz feed
 * into smooth motion without predicting anything. This buffer never extrapolates: past the newest snapshot it holds, because a
 * guessed position that the next snapshot contradicts reads as a stutter. Which moment to ask for is the `RenderClock`'s decision.
 */

/** What is drawn of a remote entity: named fields. Numbers interpolate; anything else comes from the older snapshot. */
export type RemoteFields = Readonly<Record<string, number | string | boolean>>
/** The game's view of the remote entities in one authoritative state: entity id to fields. */
export type RemoteView = Readonly<Record<string, RemoteFields>>

export interface BlendOptions {
  /** Fields taken from the newer snapshot even though they are not numbers or interpolate (a facing). */
  readonly takeNewer?: readonly string[] | undefined
  /** A numeric field and the change past which it jumps to the newer value instead of sliding (a wrap, a teleport). */
  readonly jump?: Readonly<Record<string, number>> | undefined
}

/**
 * The common blend: for each entity in the newer view, numeric fields linearly interpolated, the rest from the older view. An
 * entity only in the newer view is shown where authority says it is. An entity only in the older view has left and is dropped.
 */
export function blendViews(
  from: RemoteView,
  to: RemoteView,
  t: number,
  options: BlendOptions = {},
): RemoteView {
  const out: Record<string, RemoteFields> = {}
  for (const id of Object.keys(to)) {
    const next = to[id] as RemoteFields
    const earlier = from[id]
    if (earlier === undefined) {
      out[id] = next
      continue
    }
    const fields: Record<string, number | string | boolean> = {}
    for (const name of Object.keys(next)) {
      const a = earlier[name]
      const b = next[name] as number | string | boolean
      if (options.takeNewer?.includes(name) === true) fields[name] = b
      else if (typeof a === 'number' && typeof b === 'number') {
        const limit = options.jump?.[name]
        fields[name] = limit !== undefined && Math.abs(b - a) > limit ? b : a + (b - a) * t
      } else fields[name] = a ?? b
    }
    out[id] = fields
  }
  return out
}

export interface SnapshotBufferOptions<T> {
  /** How much history to keep, in ticks: comfortably more than the interpolation delay (eight of them). */
  readonly windowTicks: number
  /** `from` and `to` bracket the render moment; `t` is how far between them, 0..1. */
  readonly blend: (from: T, to: T, t: number) => T
}

interface Entry<T> {
  readonly tick: number
  readonly state: T
}

export class SnapshotBuffer<T> {
  private readonly entries: Entry<T>[] = []

  constructor(private readonly options: SnapshotBufferOptions<T>) {}

  get size(): number {
    return this.entries.length
  }

  latest(): Entry<T> | undefined {
    return this.entries[this.entries.length - 1]
  }

  /** The oldest tick still held: the earliest moment a slowed draw can show. */
  get oldestTick(): number | undefined {
    return this.entries[0]?.tick
  }

  /**
   * Accepts a snapshot, ignoring one at or before the newest tick: transport reordering and republished ticks must never move a
   * remote entity backward.
   */
  push(tick: number, state: T): void {
    const newest = this.latest()
    if (newest !== undefined && tick <= newest.tick) return
    this.entries.push({ tick, state })
    const horizon = tick - this.options.windowTicks
    while (this.entries.length > 2 && (this.entries[0] as Entry<T>).tick < horizon) this.entries.shift()
  }

  /** How far the newest snapshot reaches past `renderTick`, in ticks; negative is an underrun. Undefined while empty. */
  reach(renderTick: number): number | undefined {
    const newest = this.latest()
    return newest === undefined ? undefined : newest.tick - renderTick
  }

  /**
   * The view at `renderTick`. Outside the buffered range it is the nearest snapshot verbatim, so a caller always gets a real
   * authority state rather than an invented one. Undefined while empty.
   */
  sample(renderTick: number): T | undefined {
    const oldest = this.entries[0]
    const newest = this.latest()
    if (oldest === undefined || newest === undefined) return undefined
    if (renderTick <= oldest.tick) return oldest.state
    if (renderTick >= newest.tick) return newest.state
    for (let i = 0; i < this.entries.length - 1; i += 1) {
      const before = this.entries[i] as Entry<T>
      const after = this.entries[i + 1] as Entry<T>
      if (renderTick < before.tick || renderTick > after.tick) continue
      const span = after.tick - before.tick
      return this.options.blend(before.state, after.state, span === 0 ? 0 : (renderTick - before.tick) / span)
    }
    return newest.state
  }

  clear(): void {
    this.entries.length = 0
  }
}

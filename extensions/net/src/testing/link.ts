import { createRng, type Rng } from '@automata/sim'
import { Clock, Duration, Effect } from 'effect'

/** One message as it travels: text (JSON) or binary (a snapshot, a packed replay). */
export type WireData = string | Uint8Array

/** One end of a link: what `net`'s transport and the test server talk through. */
export interface Transport {
  /** Sends one message to the other end; it arrives after the link's delay, on the Effect clock. */
  send(data: WireData): Effect.Effect<void>
  /** Calls `listener` for each message that arrives here, in arrival order; returns the unsubscribe. */
  onMessage(listener: (data: WireData) => void): () => void
}

export interface LinkOptions {
  readonly seed: number
  /** Every message's base delay. */
  readonly latencyMs: number
  /** Up to this much more, drawn uniformly per message. */
  readonly jitterMs: number
  /** The chance a message is lost, 0 to 1. */
  readonly loss: number
  /** The chance a message also arrives a second time, with its own delay. */
  readonly duplicate: number
  /** The chance a message is held back by one more `latencyMs`, so later ones overtake it. */
  readonly reorder: number
}

function checkOptions(options: LinkOptions): void {
  // Two streams are derived as seed * 2 + direction and the RNG takes 32 bits, so seeds stop at 2^31 - 1 to stay
  // distinct.
  if (!Number.isInteger(options.seed) || options.seed < 0 || options.seed > 2 ** 31 - 1)
    throw new RangeError('createLink: seed must be a whole number from 0 to 2^31 - 1')
  for (const key of ['latencyMs', 'jitterMs'] as const) {
    const value = options[key]
    if (!Number.isInteger(value) || value < 0)
      throw new RangeError(`createLink: ${key} must be a whole number >= 0`)
  }
  for (const key of ['loss', 'duplicate', 'reorder'] as const) {
    const value = options[key]
    if (!(value >= 0 && value <= 1)) throw new RangeError(`createLink: ${key} must be between 0 and 1`)
  }
}

interface Pending {
  readonly due: number
  /** Send order on this end, so messages due at the same instant arrive in the order they were sent. */
  readonly order: number
  readonly data: WireData
}

function end(rng: Rng, options: LinkOptions, deliver: (data: WireData) => void): Transport['send'] {
  const pending: Pending[] = []
  let sent = 0
  // Each copy forks one sleeper; whichever wakes first delivers everything due by then, earliest first and in send
  // order on a tie, so the arrival order never depends on how the clock orders fibers that wake together.
  const flush = Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis
    pending.sort((a, b) => a.due - b.due || a.order - b.order)
    while (pending.length > 0 && (pending[0] as Pending).due <= now)
      deliver((pending.shift() as Pending).data)
  })
  // The draws for one message are always made in the same order (loss, duplicate, then for each copy reorder and
  // jitter), so a seed fixes the whole schedule whatever the message holds.
  const delay = (): number =>
    options.latencyMs +
    (rng.next() < options.reorder ? options.latencyMs : 0) +
    (options.jitterMs > 0 ? rng.int(options.jitterMs) : 0)
  return (data) =>
    Effect.gen(function* () {
      const lost = rng.next() < options.loss
      const copies = rng.next() < options.duplicate ? 2 : 1
      if (lost) return
      const now = yield* Clock.currentTimeMillis
      for (let copy = 0; copy < copies; copy++) {
        const ms = delay()
        pending.push({ due: now + ms, order: sent++, data })
        yield* Effect.forkDaemon(Effect.sleep(Duration.millis(ms)).pipe(Effect.andThen(flush)))
      }
    })
}

/**
 * A deterministic in-memory link (M7 spec §4.7): every delay, loss, duplicate and reorder is drawn from `seed`, one
 * stream per direction, and delivery waits on the Effect clock, so under `TestClock` a failure replays exactly.
 */
export function createLink(options: LinkOptions): { client: Transport; server: Transport } {
  checkOptions(options)
  const listeners = {
    client: new Set<(data: WireData) => void>(),
    server: new Set<(data: WireData) => void>(),
  }
  const deliverTo = (side: 'client' | 'server') => (data: WireData) => {
    // A copy, so a listener added during delivery waits for the next message; the `has` check skips one removed by an
    // earlier listener of this message.
    for (const listener of [...listeners[side]]) if (listeners[side].has(listener)) listener(data)
  }
  const transport = (side: 'client' | 'server', other: 'client' | 'server', stream: number): Transport => ({
    send: end(createRng(options.seed * 2 + stream), options, deliverTo(other)),
    onMessage(listener) {
      listeners[side].add(listener)
      return () => listeners[side].delete(listener)
    },
  })
  return { client: transport('client', 'server', 0), server: transport('server', 'client', 1) }
}

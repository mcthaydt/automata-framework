import type { Clock } from '@automata/framework'
import { createRng, type Rng } from '@automata/sim'

/** One message as it travels: text (JSON) or binary (a snapshot, a packed replay). */
export type WireData = string | Uint8Array

/** One end of a link: what `net`'s transport and the test server talk through. */
export interface Transport {
  /** Sends one message to the other end; it arrives after the link's delay, on the link's clock. */
  send(data: WireData): void
  /** Calls `listener` for each message that arrives here, in arrival order; returns the unsubscribe. */
  onMessage(listener: (data: WireData) => void): () => void
}

/**
 * How bad a test link is: a seed, the base delay, the jitter, and the chances a message is lost,
 * arrives twice or is held back so later ones overtake it.
 */
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

function end(
  rng: Rng,
  options: LinkOptions,
  clock: Clock,
  deliver: (data: WireData) => void,
): Transport['send'] {
  const pending: Pending[] = []
  let sent = 0
  // Each copy sets one timer; whichever fires first delivers everything due by then, earliest first and in send
  // order on a tie, so the arrival order never depends on how the clock orders timers that fire together.
  const flush = (): void => {
    const now = clock.now()
    pending.sort((a, b) => a.due - b.due || a.order - b.order)
    while (pending.length > 0 && (pending[0] as Pending).due <= now)
      deliver((pending.shift() as Pending).data)
  }
  // The draws for one message are always made in the same order (loss, duplicate, then for each copy reorder and
  // jitter), so a seed fixes the whole schedule whatever the message holds.
  const delay = (): number =>
    options.latencyMs +
    (rng.next() < options.reorder ? options.latencyMs : 0) +
    (options.jitterMs > 0 ? rng.int(options.jitterMs) : 0)
  return (data) => {
    const lost = rng.next() < options.loss
    const copies = rng.next() < options.duplicate ? 2 : 1
    if (lost) return
    const now = clock.now()
    for (let copy = 0; copy < copies; copy++) {
      const ms = delay()
      pending.push({ due: now + ms, order: sent++, data })
      // No delay is no timer: a perfect link hands the message over before `send` returns.
      if (ms === 0) flush()
      else clock.setTimeout(flush, ms)
    }
  }
}

/**
 * A deterministic in-memory link: every delay, loss, duplicate and reorder is drawn from `seed`, one stream per
 * direction, and delivery waits on `clock`, so under a fake clock a failure replays exactly.
 */
export function createLink(options: LinkOptions, clock: Clock): { client: Transport; server: Transport } {
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
    send: end(createRng(options.seed * 2 + stream), options, clock, deliverTo(other)),
    onMessage(listener) {
      listeners[side].add(listener)
      return () => listeners[side].delete(listener)
    },
  })
  return { client: transport('client', 'server', 0), server: transport('server', 'client', 1) }
}

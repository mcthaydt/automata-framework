/**
 * The bots a room has seated: each one's own random stream and the numbering of its commands.
 *
 * Whether a seat is a bot is the lobby's (`rules/bot-seats.ts`); this is what the room keeps for a bot once it
 * sits: the stream the game's `BotPolicy` draws from and the `seq` its commands carry into the input queue.
 */

import { createRng, type Rng } from '@automata/sim'
import type { BotPolicy } from '../../../shared/game/server-game'
import type { SimView } from '../../../shared/game/sim-view'
import type { QueuedInput } from '../rules/input-queue'

interface BotSeat {
  readonly rng: Rng
  seq: number
}

export class BotRoster {
  private readonly seated = new Map<number, BotSeat>()

  /** A bot sat down on `seat`, drawing from the stream seeded with `seed`. */
  add(seat: number, seed: number): void {
    this.seated.set(seat, { rng: createRng(seed), seq: 0 })
  }

  remove(seat: number): void {
    this.seated.delete(seat)
  }

  /** The bots' seats, in no promised order. */
  seats(): IterableIterator<number> {
    return this.seated.keys()
  }

  /** A new game: every bot numbers its commands from 0 again. */
  restart(): void {
    for (const bot of this.seated.values()) bot.seq = 0
  }

  /**
   * Asks the policy for each bot's commands, lowest seat first, and hands each to `submit`. Bots decide on the state
   * the last tick left, and their commands take effect on `tick`.
   */
  drive(
    policy: BotPolicy,
    view: SimView,
    tick: number,
    submit: (seat: number, input: QueuedInput) => void,
  ): void {
    for (const seat of [...this.seated.keys()].sort((a, b) => a - b)) {
      const bot = this.seated.get(seat)
      if (bot === undefined) continue
      for (const intent of policy.commands(view, seat, bot.rng)) {
        submit(seat, { seq: bot.seq, tick, type: intent.type, payload: intent.payload })
        bot.seq += 1
      }
    }
  }
}

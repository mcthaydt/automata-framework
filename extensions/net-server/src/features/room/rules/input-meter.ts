/**
 * Each seat's command budget: a token bucket on the room clock.
 *
 * A seat may bank up to `capacity` commands and spends one per accepted command, refilling a little faster than
 * the tick rate so ordinary play never touches the limit. Budgets are measured on the room clock rather than wall
 * time, so a client cannot widen them by stalling the server.
 *
 * A command over budget is dropped, never answered with a disconnect: a burst is far more often a slow
 * frame than an attack, and dropping costs the player one tick of intent.
 *
 * No I/O and no clock: the room calls `refill` once per tick.
 */

export interface InputMeterOptions {
  /** The most commands a seat can bank: one second's worth, `tickHz`. */
  readonly capacity: number
  /** Commands a seat earns back per room tick. */
  readonly creditsPerTick: number
}

export class InputMeter {
  private readonly credits = new Map<number, number>()
  private readonly options: InputMeterOptions

  constructor(options: InputMeterOptions) {
    this.options = options
  }

  /** Gives a seat a full budget: on joining, and again on reconnecting. */
  fill(seat: number): void {
    this.credits.set(seat, this.options.capacity)
  }

  /**
   * Spends one command's credit. Returns false when the seat is out of credit, and the caller drops the command. A
   * seat the meter has never seen has no credit.
   */
  spend(seat: number): boolean {
    const credits = this.credits.get(seat) ?? 0
    if (credits <= 0) return false
    this.credits.set(seat, credits - 1)
    return true
  }

  /** Earns each listed seat one tick's credit, up to the cap. Once per tick. */
  refill(seats: Iterable<number>): void {
    for (const seat of seats) {
      const credits = this.credits.get(seat) ?? 0
      this.credits.set(seat, Math.min(this.options.capacity, credits + this.options.creditsPerTick))
    }
  }

  /** Drops a seat's budget, for a seat that has left for good. */
  forget(seat: number): void {
    this.credits.delete(seat)
  }
}

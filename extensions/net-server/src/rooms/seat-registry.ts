/**
 * Which session sits in which seat, and what each seat is still owed (FloorFifty `seat-registry.ts`, keyed by the
 * seat number the sim knows as `source`).
 *
 * Two things can be pending on a seat:
 *
 * - An announcement: net's `seated` message, which tells a client its own seat, the one thing a snapshot cannot
 *   tell it. It waits for the next tick because the room's join handler runs before the client has registered its
 *   handler, so a message sent from there is lost. Joins and reconnects both queue here, so there is exactly one
 *   path by which a client learns its seat (spec §4.3).
 * - A reconnection hold: after an unexpected drop the seat is kept for the grace period (net's
 *   `reconnectGraceSeconds`), so a player whose train went through a tunnel comes back to the same room.
 *
 * No Colyseus import: a client is anything with `send`, and a hold is a cancel callback. Bot seats have no session
 * and are not here; the lobby holds them.
 */

import type { ServerMessage } from '@automata/net'

/** The one thing the registry does with a client: tell it where it sits. */
export interface SeatClient {
  send(message: ServerMessage): void
}

/** A seat freed by `keepOnly`, so the room can forget what else it held. */
export interface FreedSeat {
  readonly session: string
  readonly seat: number
}

export class SeatRegistry {
  /** The seat per session, in the order they first sat down. */
  private readonly bySession = new Map<string, number>()
  /** Clients still waiting to hear their own seat. */
  private readonly unannounced = new Map<string, SeatClient>()
  /** How to cancel each pending reconnection, keyed by the session that dropped. */
  private readonly holds = new Map<string, () => void>()
  private seatedOnce = false

  /** Seats taken, counting those held for a player who dropped. */
  get size(): number {
    return this.bySession.size
  }

  /** Whether anyone has ever sat down: an empty room that has had a player is abandoned; one that has not is new. */
  get everSeated(): boolean {
    return this.seatedOnce
  }

  seatOf(session: string): number | undefined {
    return this.bySession.get(session)
  }

  /** The session sitting in `seat`, if it still holds it. */
  sessionOf(seat: number): string | undefined {
    for (const [session, seated] of this.bySession) if (seated === seat) return session
    return undefined
  }

  /** Every seat a session holds, in seating order: a copy, safe to keep. */
  seats(): number[] {
    return [...this.bySession.values()]
  }

  /**
   * Every seat a session holds, in seating order, without copying: for loops that run on every tick. Do not seat
   * or free anyone while iterating it.
   */
  seated(): Iterable<number> {
    return this.bySession.values()
  }

  /** Seats a session and queues its announcement: on a join and again on a reconnect, which keeps its place. */
  seat(session: string, seat: number, client: SeatClient): void {
    this.bySession.set(session, seat)
    this.unannounced.set(session, client)
    this.seatedOnce = true
  }

  /**
   * Frees a seat for good; nothing is announced to it afterwards. It does not touch a reconnection hold: a caller
   * freeing a dropped seat calls `closeHold` first, or the token stays valid.
   */
  release(session: string): void {
    this.bySession.delete(session)
    this.unannounced.delete(session)
  }

  /** Frees every seat `keep` rejects, and says which ones it freed. */
  keepOnly(keep: (seat: number) => boolean): FreedSeat[] {
    const freed: FreedSeat[] = []
    for (const [session, seat] of [...this.bySession]) {
      if (keep(seat)) continue
      this.release(session)
      freed.push({ session, seat })
    }
    return freed
  }

  /**
   * Tells each waiting client its seat. Once per tick. A client that disconnected after it was queued makes `send`
   * throw; its seat has already been dealt with by the room's leave handler, so the failure is swallowed and the
   * other clients are still told.
   */
  announce(): void {
    // Almost always empty: return before copying anything, every tick.
    if (this.unannounced.size === 0) return
    for (const [session, client] of [...this.unannounced]) {
      this.unannounced.delete(session)
      const seat = this.bySession.get(session)
      if (seat === undefined) continue
      try {
        client.send({ t: 'seated', seat })
      } catch {
        // Gone between the queue and the tick; the leave handler decided what the seat became.
      }
    }
  }

  /** Records how to cancel the reconnection held for a dropped session. */
  hold(session: string, cancel: () => void): void {
    this.holds.set(session, cancel)
  }

  /** Forgets a hold that has settled: the player came back, or the grace ran out. */
  endHold(session: string): void {
    this.holds.delete(session)
  }

  /** Ends a hold early. Its token stops working, so a client still holding it is refused rather than seated. */
  closeHold(session: string): void {
    const cancel = this.holds.get(session)
    if (cancel === undefined) return
    this.holds.delete(session)
    cancel()
  }
}

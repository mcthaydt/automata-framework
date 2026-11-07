/**
 * Holding a room's clocks, for tests.
 *
 * A countdown ends on a tick of the room's own clock, and that clock runs at the speed of whatever machine hosts it.
 * A browser test that looks at a screen for as long as it needs, or reloads a page and waits for it, cannot ask the
 * machine for speed; it asks the room to keep the screen up instead.
 *
 * Holding does not stop the room. Ticks keep coming, snapshots keep going out, and a client that joins or comes back
 * is still seated on the next tick. What stands still is the deadline: each tick a held clock's end is pushed back by
 * that tick. While anything is held, a dropped seat's deadline is pushed back too, and Colyseus, which counts its
 * reconnection window in wall seconds, is asked to wait long enough for any reload (`heldGraceSeconds`).
 *
 * Only the test driver asks for this (`server/testing`), and never in production: the
 * room refuses a hold when `NODE_ENV` is `production`.
 */

import type { LobbyState } from './lobby-rules'

/** A clock a room can be asked to hold. The countdown is the one a client watches run out. */
export type ClockName = 'countdown'

export const CLOCK_NAMES: readonly ClockName[] = ['countdown']

export function isClockName(value: unknown): value is ClockName {
  return typeof value === 'string' && (CLOCK_NAMES as readonly string[]).includes(value)
}

/** How long Colyseus keeps a seat that dropped while the room was held, in wall seconds. */
export const HELD_GRACE_SECONDS: number = 10 * 60

/** Whether a hold may be taken in this environment: never in production. */
export function holdAllowed(env: Readonly<Record<string, string | undefined>>): boolean {
  // Read as process safety reads it (`isProduction`): trimmed and in any case.
  return env.NODE_ENV?.trim().toLowerCase() !== 'production'
}

/** The wall seconds Colyseus keeps a seat that has just dropped. */
export function heldGraceSeconds(held: ReadonlySet<ClockName>, graceSeconds: number): number {
  return held.size > 0 ? HELD_GRACE_SECONDS : graceSeconds
}

/**
 * Called once per tick, before any deadline is looked at: pushes the countdown's end back by one tick if it is held,
 * and every dropped seat's deadline (`drops`, seat to tick) with it while anything is held. A countdown that is not
 * running has no end to move.
 */
export function pushHeldDeadlines(
  lobby: LobbyState,
  drops: Map<number, number>,
  held: ReadonlySet<ClockName>,
): void {
  if (held.size === 0) return
  for (const [seat, deadline] of drops) drops.set(seat, deadline + 1)
  if (lobby.phase === 'countdown' && lobby.countdownEndsAtTick !== undefined && held.has('countdown'))
    lobby.countdownEndsAtTick += 1
}

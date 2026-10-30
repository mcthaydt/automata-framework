/**
 * What a room's clock and inputs are doing, as log events (M7 spec §4.3's table: FloorFifty `room-telemetry.ts`'
 * slow ticks, step spikes and late inputs become §4.5's `tick.slow`, `step.slow` and `input.late`).
 *
 * None of these throw; they show up as a game that feels wrong, and the log is how an operator tells which. They are
 * also what a slow room or a laggy client produces every tick, so each kind is written at most once per room every
 * ten seconds (FloorFifty's anomaly cooldown), and `input.late` once per seat, so one client cannot fill the
 * journal. FloorFifty's summaries, physics counters and debug endpoint are left behind (PD-5).
 */

import type { RoomLogEvent } from '../game/server-config'

/** One line per anomaly kind per room (and per seat for late inputs), at most this often. */
export const ANOMALY_COOLDOWN_MS: number = 10_000

const ANOMALIES: ReadonlySet<string> = new Set(['tick.slow', 'step.slow', 'input.late'])

/** A step that took more than half its tick: two back to back would miss a tick (FloorFifty `SLOW_TICK_MS`). */
export function slowStepMs(tickHz: number): number {
  return 1000 / tickHz / 2
}

/**
 * Whether an event may be written now. Anomalies are limited on `now` (the room's clock, in milliseconds); every
 * other event passes.
 */
export function createAnomalyLimiter(
  now: () => number,
  cooldownMs: number = ANOMALY_COOLDOWN_MS,
): (event: RoomLogEvent) => boolean {
  const lastAt = new Map<string, number>()
  return (event) => {
    if (!ANOMALIES.has(event.event)) return true
    const key = event.event === 'input.late' ? `${event.event}:${event.seat ?? ''}` : event.event
    const at = now()
    const last = lastAt.get(key)
    if (last !== undefined && at - last < cooldownMs) return false
    lastAt.set(key, at)
    return true
  }
}

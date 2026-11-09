/** The first wait after a drop. */
export const RECONNECT_BASE_MS = 250
/** The longest wait between two attempts. */
export const RECONNECT_CEILING_MS = 2_000

/**
 * The wait before reconnect attempt `attempt` (from 0): 250 ms doubling to a 2 s ceiling. The climbing steps are spread by ±25%, so a server restart does not bring every client back on
 * the same beat; the ceiling is not spread, so the attempts keep their pace through a long outage. `random` is in
 * [0, 1]: injected, so a test chooses the spread.
 */
export function reconnectDelay(attempt: number, random: () => number): number {
  const base = Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_CEILING_MS)
  return base === RECONNECT_CEILING_MS ? base : base * (0.75 + 0.5 * random())
}

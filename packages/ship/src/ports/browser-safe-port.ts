/**
 * The Fetch standard's bad ports from 1024 up (https://fetch.spec.whatwg.org/#port-blocking). Chromium, WebKit and
 * Firefox all refuse them (`net::ERR_UNSAFE_PORT`), so a journey whose server sits on one fails before its page loads.
 */
const BAD_PORTS: ReadonlySet<number> = new Set([
  1719, 1720, 1723, 2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669, 6679, 6697,
  10080,
])

/**
 * Ports a Mac holds that no browser blocks: the AirPlay Receiver (macOS 12 and later, on by default) listens on 5000
 * and 7000. A journey server there is "already used" (Playwright answers from AirPlay, not from the game), which kept
 * the nightly's browser journeys red on the runner's Mac from 2026-10-16.
 */
const MAC_AIRPLAY_PORTS: ReadonlySet<number> = new Set([5000, 7000])

/**
 * `port`, or the next port above it that browsers load and the test machines leave free. Use it for every port derived
 * by an offset from `portsFor`'s pair (CI's fixed pair puts the examples fixtures at 6000 and Emberwick at 5000).
 * Locally a moved port can equal a neighbouring worktree's in the same range; that needs two checkouts on adjacent
 * hash slots running at once, and never happens in CI.
 */
export function browserSafePort(port: number): number {
  let safe = port
  while (BAD_PORTS.has(safe) || MAC_AIRPLAY_PORTS.has(safe)) safe += 1
  return safe
}

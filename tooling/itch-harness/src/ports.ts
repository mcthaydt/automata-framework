import { portsFor } from '../../../packages/ship/src/ports/ports-for.ts'

/**
 * Where the itch-like harness listens, beside every example's servers in one `pnpm test:e2e`
 * (examples/demo-host/ports.ts lists the others): the embed page 600 above the checkout's server port
 * (5200–5399) and the game origin 1500 above its preview port (6200–6299). Neither range holds a port
 * Chromium refuses to load (6000 would be one).
 */
export function itchHarnessPorts(env: Readonly<Record<string, string | undefined>>): {
  page: number
  game: number
} {
  const ports = portsFor(new URL('../../..', import.meta.url).pathname, env)
  return { page: ports.server + 600, game: ports.preview + 1500 }
}

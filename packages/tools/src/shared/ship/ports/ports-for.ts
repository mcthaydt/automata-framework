/**
 * The ports a checkout's test server and preview build listen on.
 * Several agents run at once, each in its own worktree; with fixed ports a second run either failed on a busy
 * port or, reusing the first run's server, silently tested another worktree's code. So each checkout path
 * hashes to its own slot. AF uses 4600–4799; a second
 * example in the same run adds a fixed offset (the ui demo +100 on the preview port, Emberwick (`games/emberwick`) +300).
 * CI uses the fixed pair. Several runner copies share one machine, so each copy's `.env` sets
 * AF_RUNNER_PORT_OFFSET to its own multiple of 2000: the pair moves up by that much, and everything derived from it
 * (the examples runner's ports reach 1600 above the preview port) moves with it, so jobs on two copies never meet on a port.
 * AF_E2E_SERVER_PORT / AF_E2E_PREVIEW_PORT override.
 */
export function portsFor(
  checkoutPath: string,
  env: Readonly<Record<string, string | undefined>>,
): { server: number; preview: number } {
  if (env.GITHUB_ACTIONS !== undefined) {
    const offset = Number(env.AF_RUNNER_PORT_OFFSET || 0)
    return { server: 4600 + offset, preview: 4700 + offset }
  }
  let hash = 0
  for (const char of checkoutPath) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  const slot = hash % 100
  return {
    server: Number(env.AF_E2E_SERVER_PORT ?? 4600 + slot),
    preview: Number(env.AF_E2E_PREVIEW_PORT ?? 4700 + slot),
  }
}

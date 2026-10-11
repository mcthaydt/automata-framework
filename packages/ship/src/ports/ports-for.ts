/**
 * The ports a checkout's test server and preview build listen on (FloorFifty `playwright.config.ts`).
 * Several agents run at once, each in its own worktree; with fixed ports a second run either failed on a busy
 * port or, reusing the first run's server, silently tested another worktree's code. So each checkout path
 * hashes to its own slot. AF uses 4600–4799, clear of FloorFifty's 4400–4599 on the same machine.
 * CI runs one job per machine and uses the fixed pair; AF_E2E_SERVER_PORT / AF_E2E_PREVIEW_PORT override.
 */
export function portsFor(
  checkoutPath: string,
  env: Readonly<Record<string, string | undefined>>,
): { server: number; preview: number } {
  if (env.GITHUB_ACTIONS !== undefined) return { server: 4600, preview: 4700 }
  let hash = 0
  for (const char of checkoutPath) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  const slot = hash % 100
  return {
    server: Number(env.AF_E2E_SERVER_PORT ?? 4600 + slot),
    preview: Number(env.AF_E2E_PREVIEW_PORT ?? 4700 + slot),
  }
}

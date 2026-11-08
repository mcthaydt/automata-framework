import { rmSync } from 'node:fs'

interface RemoveDeps {
  readonly remove?: typeof rmSync
  readonly warn?: (message: string) => void
}

/**
 * Removes the layout run's temporary browser profiles (vitest.config.ts). A browser may still be writing to its
 * profile while it shuts down (Chromium on the Mac left `ENOTEMPTY`), so the removal retries; if it still fails it
 * warns and returns false, and the removal at process exit tries again. A cleanup failure never fails the run.
 */
export function removeProfiles(profiles: string | undefined, deps: RemoveDeps = {}): boolean {
  if (profiles === undefined) return true
  const remove = deps.remove ?? rmSync
  try {
    remove(profiles, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
    return true
  } catch (error) {
    const warn = deps.warn ?? ((message: string) => console.warn(message))
    warn(`Could not remove the temporary browser profiles at ${profiles} yet: ${String(error)}`)
    return false
  }
}

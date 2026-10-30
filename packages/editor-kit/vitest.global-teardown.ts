import { rmSync } from 'node:fs'

// Removes the run's temporary browser profiles (vitest.config.ts). The teardown runs before Vitest closes the
// browsers, and Chromium still writes to its profile while it shuts down, so the removal runs again when the process
// exits, after every browser is gone.
export default function setup(): () => void {
  const profiles = process.env.AF_EDITOR_KIT_PROFILES
  const remove = (): void => {
    if (profiles !== undefined) rmSync(profiles, { recursive: true, force: true })
  }
  process.once('exit', remove)
  return remove
}

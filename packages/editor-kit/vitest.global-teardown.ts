import { removeProfiles } from './scripts/remove-profiles.ts'

// Removes the run's temporary browser profiles (vitest.config.ts). The teardown runs before Vitest closes the
// browsers, and Chromium still writes to its profile while it shuts down, so the removal runs again when the process
// exits, after every browser is gone. Neither attempt can fail the run.
export default function setup(): () => void {
  const remove = (): void => {
    removeProfiles(process.env.AF_EDITOR_KIT_PROFILES)
  }
  process.once('exit', remove)
  return remove
}

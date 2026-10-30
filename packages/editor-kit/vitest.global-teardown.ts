import { removeProfiles } from './scripts/remove-profiles.ts'

// Removes the run's temporary browser profiles (vitest.config.ts) when the run ends. Chromium can still be writing to
// its profile then, so this may only warn; vitest.config.ts removes the directory again when the process exits.
// Neither attempt can fail the run.
export default function setup(): () => void {
  return () => {
    removeProfiles(process.env.AF_EDITOR_KIT_PROFILES)
  }
}

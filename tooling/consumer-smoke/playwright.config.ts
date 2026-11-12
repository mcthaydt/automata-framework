import { defineJourneys, sizes } from '@automataframework/playwright-preset'

// The stranger's journey (tests/e2e/stranger.test.ts): `pnpm test:e2e` in this folder. It needs no server of its own;
// it packs the published packages (turbo builds them first), makes a game in an empty folder outside the repository,
// and serves the game's build itself. One Chromium project: the journey is about the commands, not the screen size.
export default defineJourneys({
  testDir: 'tests/e2e',
  // Two installs and four builds. About five minutes on a quiet machine; the rest is headroom for a shared runner.
  timeout: 20 * 60_000,
  // No retry: a flaky install is a finding, and a retry would hide the first attempt.
  retries: 0,
  projects: [{ name: 'stranger-chromium', use: { ...sizes.phone, browserName: 'chromium' } }],
})

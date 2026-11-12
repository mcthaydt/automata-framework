import { defineJourneys, sizes } from '@automata/playwright-preset'
import { devPort, devUrl } from './tests/e2e/origins.ts'

// The Last Light's browser journeys: `pnpm test:e2e` in this folder, run by the 3D workflow (.github/workflows/3d.yml) and by
// `pnpm ci:local`, not by the 2D gate. The config starts only the game's dev server, so a run never waits on another area's build.
//
// The game is landscape: a phone held sideways (844 by 390), the size it is designed at first. The prologue is played through the
// page's real renderer, which in a software renderer runs the simulation slower than the clock, so a journey waits on the game's
// own state and never on a sleep. This container runs Chromium; WebKit is the 3D runner's and is reported as not run here.

export default defineJourneys({
  testDir: 'tests/e2e',
  // A night played end to end in a software renderer takes minutes.
  timeout: 12 * 60_000,
  projects: [
    {
      name: 'the-last-light-chromium',
      use: { ...sizes.phone, viewport: { width: 844, height: 390 }, browserName: 'chromium' },
    },
  ],
  webServer: [
    {
      command: 'pnpm e2e:dev',
      url: devUrl,
      env: { AF_E2E_DEV_PORT: String(devPort) },
      reuseExistingServer: process.env.CI === undefined,
    },
  ],
})

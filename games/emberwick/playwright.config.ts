import { defineJourneys, sizes } from '@mcthaydt/playwright-preset'
import { gameBuildPath, gamePort, gameUrl, hostOrigin, hostPort } from './tests/e2e/origins.ts'

// Emberwick's browser journeys: `pnpm test:e2e` in this folder. The config starts only Emberwick's two servers
// (the game's production build and the fake Ruken host around it), so a run never waits on another area's build.
//
// Every journey runs at a phone size and in two engines, Chromium and WebKit (iOS Safari is WebKit, so a
// Chromium-only pass says little about the Owner's iPad), plus the compact landscape height and the iPad.
// The golden route plays 342 frames in a software renderer and takes a minute, so it is tagged `@slow` and runs
// only at the iPad size, the Owner's device, in each engine.

const ports = {
  AF_E2E_PREVIEW_PORT: String(gamePort),
  AF_E2E_SERVER_PORT: String(hostPort),
  AF_E2E_GAME_PATH: gameBuildPath,
}
const quick = { grepInvert: /@slow/ }

export default defineJourneys({
  testDir: 'tests/e2e',
  projects: [
    // Phone first (AGENTS.md, Responsive UI).
    { name: 'emberwick-phone-chromium', use: { ...sizes.phone, browserName: 'chromium' }, ...quick },
    { name: 'emberwick-phone-webkit', use: { ...sizes.phone, browserName: 'webkit' }, ...quick },
    { name: 'emberwick-compact-chromium', use: { ...sizes.compact, browserName: 'chromium' }, ...quick },
    { name: 'emberwick-ipad-chromium', use: { ...sizes.ipad, browserName: 'chromium' } },
    { name: 'emberwick-ipad-webkit', use: { ...sizes.ipad, browserName: 'webkit' } },
  ],
  webServer: [
    {
      command: 'pnpm e2e:game',
      url: gameUrl,
      env: ports,
      reuseExistingServer: process.env.CI === undefined,
    },
    {
      command: 'pnpm e2e:host',
      url: `${hostOrigin}/`,
      env: ports,
      reuseExistingServer: process.env.CI === undefined,
    },
  ],
})

import { defineJourneys, sizes } from '@automataframework/playwright-preset'
import {
  devPort,
  devUrl,
  gameBuildPath,
  gamePort,
  gameUrl,
  hostOrigin,
  hostPort,
} from './tests/e2e/origins.ts'

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
  AF_E2E_DEV_PORT: String(devPort),
}
// The dev journey (dev.test.ts) edits the dev server's one copy of the tuning, so it runs in one project only.
const DEV_JOURNEY = /dev\.test\.ts/
// The six-language journey runs in its own projects (one per language) and nowhere else.
const LANGUAGES_JOURNEY = /emberwick-languages\.test\.ts/
const OTHER_JOURNEYS = [DEV_JOURNEY, LANGUAGES_JOURNEY]
const quick = { grepInvert: /@slow/, testIgnore: OTHER_JOURNEYS }

// The browser's language for each of the six: the game matches it on its primary subtag (`zh-CN` lands on Simplified).
const LANGUAGES = ['en', 'ja', 'ko', 'es-419', 'pt-BR', 'zh-CN'] as const

export default defineJourneys({
  testDir: 'tests/e2e',
  projects: [
    // Phone first (AGENTS.md, Responsive UI).
    { name: 'emberwick-phone-chromium', use: { ...sizes.phone, browserName: 'chromium' }, ...quick },
    { name: 'emberwick-phone-webkit', use: { ...sizes.phone, browserName: 'webkit' }, ...quick },
    { name: 'emberwick-compact-chromium', use: { ...sizes.compact, browserName: 'chromium' }, ...quick },
    {
      name: 'emberwick-ipad-chromium',
      use: { ...sizes.ipad, browserName: 'chromium' },
      testIgnore: OTHER_JOURNEYS,
    },
    {
      name: 'emberwick-ipad-webkit',
      use: { ...sizes.ipad, browserName: 'webkit' },
      testIgnore: OTHER_JOURNEYS,
    },
    // Each language at phone size in Chromium: the first run, the menu, pause and back, in that language's words and font.
    ...LANGUAGES.map((locale) => ({
      name: `emberwick-language-${locale}`,
      use: { ...sizes.phone, browserName: 'chromium' as const, locale },
      testMatch: LANGUAGES_JOURNEY,
    })),
    // The game on its dev server, as the Tuner's game pane shows it: a saved setting restarts it in place.
    {
      name: 'emberwick-dev-chromium',
      use: { ...sizes.ipad, browserName: 'chromium' },
      testMatch: DEV_JOURNEY,
    },
  ],
  webServer: [
    {
      command: 'pnpm e2e:game',
      url: gameUrl,
      env: ports,
      reuseExistingServer: process.env.CI === undefined,
    },
    {
      // Never reused: it must compile this run's copy of content/.
      command: 'pnpm e2e:dev',
      url: devUrl,
      env: ports,
      reuseExistingServer: false,
    },
    {
      command: 'pnpm e2e:host',
      url: `${hostOrigin}/`,
      env: ports,
      reuseExistingServer: process.env.CI === undefined,
    },
  ],
})

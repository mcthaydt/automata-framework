import { defineJourneys, sizes } from '@mcthaydt/playwright-preset'
import { newGameUrl } from './tests/e2e/origin.ts'

// The framework's own journey: `pnpm build` at the root, then `pnpm test:e2e` in this folder. It starts one server, the game `create-game`
// writes (tests/e2e/serve-new-game.ts), at a phone size in Chromium.
export default defineJourneys({
  testDir: 'tests/e2e',
  // Scaffolding and building the new game takes about a minute on a quiet machine.
  timeout: 60_000,
  projects: [{ name: 'create-game-phone-chromium', use: { ...sizes.phone, browserName: 'chromium' } }],
  webServer: [
    {
      command: 'node tests/e2e/serve-new-game.ts',
      url: newGameUrl,
      timeout: 300_000,
      // Never reused: the server must build this run's create-game output.
      reuseExistingServer: false,
    },
  ],
})

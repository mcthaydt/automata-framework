import { defineJourneys, sizes } from '@automata/playwright-preset'

// The editor's real journeys (`pnpm test:e2e`): each one copies a game to a temp folder, runs the built
// `automata editor` on it and works the editor as a person would, Save included. The journeys start their own
// servers (tests/e2e/harness/), so the config starts none. Build first: `pnpm build` (the tools and this editor).
// The iPad is the Owner's device; WebKit runs on the Owner's Mac (it is not installed in cloud sessions).
export default defineJourneys({
  testDir: 'tests/e2e/journeys',
  timeout: 60_000,
  projects: [
    { name: 'editor-ipad-chromium', use: { ...sizes.ipad, browserName: 'chromium' } },
    { name: 'editor-phone-chromium', use: { ...sizes.phone, browserName: 'chromium' } },
    { name: 'editor-ipad-webkit', use: { ...sizes.ipad, browserName: 'webkit' } },
  ],
})

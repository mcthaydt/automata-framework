import { defineJourneys } from '@automata/playwright-preset'

// The content editors' real journeys (`pnpm test:e2e`): each one copies the 2D story to a temp folder, runs the built
// `automata editor` on it with this package's suite page, works Feel, Audio, Writer or Sequence as a person would, then
// plays the game the editor started and looks at what the person made. The journeys start their own servers
// (tests/e2e/harness/), so the config starts none. Build first: `pnpm build` (the tools, the editor and this package).
// Chromium only here: WebKit and Firefox run on the Owner's machines (they are not installed in cloud sessions).
export default defineJourneys({
  testDir: 'tests/e2e/journeys',
  timeout: 120_000,
  projects: [
    // The sizes every editor layout must hold (AGENTS.md, Responsive UI): a phone first, then the iPad.
    {
      name: 'editors-phone-chromium',
      use: { browserName: 'chromium', viewport: { width: 390, height: 844 } },
    },
    {
      name: 'editors-ipad-chromium',
      use: { browserName: 'chromium', viewport: { width: 820, height: 1180 } },
    },
  ],
})

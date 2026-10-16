import { goldenCommands } from '@mcthaydt/automata-testing/sim/commands'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

// Node runs every unit test, including the examples' golden replays (examples.parity.test.ts); the browsers
// project replays the same goldens in Chromium, WebKit and Firefox (EX spec §4). src/fixtures/ holds example
// files, not tests.
export default defineConfig({
  // The sim's dependencies, pre-bundled up front. No discovery: the dependency scan would follow the parity test's
  // globs into pending examples, whose imports do not resolve yet, give up, and reload the page mid-run.
  optimizeDeps: { noDiscovery: true, include: ['koota', 'zod'] },
  test: {
    projects: [
      { test: { name: 'node', environment: 'node', include: ['src/**/*.test.ts'] } },
      {
        test: {
          name: 'browsers',
          include: ['src/**/*.parity.test.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            // Goldens are read in a browser through this command (browsers read goldens, never write them).
            commands: goldenCommands(),
            instances: [{ browser: 'chromium' }, { browser: 'webkit' }, { browser: 'firefox' }],
          },
        },
      },
    ],
  },
})

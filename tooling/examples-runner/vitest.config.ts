import { fileURLToPath } from 'node:url'
import { goldenCommands } from '@mcthaydt/automata-testing/sim/commands'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

// Node runs every unit test, including the examples' golden replays (examples.parity.test.ts); the browsers
// project replays the same goldens in Chromium, WebKit and Firefox (EX spec §4). src/fixtures/ holds example
// files, not tests.
export default defineConfig({
  // An example's default export is a whole game (`defineGame`), whose default screens are Svelte components.
  plugins: [svelte()],
  // The sim's dependencies, pre-bundled up front. No discovery: the dependency scan would follow the parity test's
  // globs into pending examples, whose imports do not resolve yet, give up, and reload the page mid-run.
  // An example's game also brings PixiJS, whose CommonJS dependencies (eventemitter3, earcut) a browser can only
  // import pre-bundled.
  optimizeDeps: { noDiscovery: true, include: ['koota', 'zod', '@mcthaydt/automata-render-pixi > pixi.js'] },
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
            // Goldens are read in a browser through this command (browsers read goldens, never write them), from
            // anywhere in the repository: the examples' goldens sit in examples/__goldens__, outside this package.
            commands: goldenCommands({ root: repoRoot }),
            instances: [{ browser: 'chromium' }, { browser: 'webkit' }, { browser: 'firefox' }],
          },
        },
      },
    ],
  },
})

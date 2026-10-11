import { goldenCommands } from '@mcthaydt/automata-testing/sim/commands'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

// unit: pure data and fixtures in jsdom. layout: the DOM assertions against planted problems in real browsers.
// sim: the golden and replay harness in Node, without the `browser` condition. sim-browsers: the goldens in
// three browsers, so every golden runs in four engines (M2.3 spec §3.8).
export default defineConfig({
  plugins: [svelte()],
  // Svelte's browser build in jsdom too, so mount() works in unit tests.
  resolve: { conditions: ['browser'] },
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.layout.test.ts', 'src/sim/**'],
        },
      },
      {
        test: {
          name: 'layout',
          include: ['src/**/*.layout.test.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }, { browser: 'webkit' }, { browser: 'firefox' }],
          },
        },
      },
      {
        resolve: { conditions: [] },
        test: {
          name: 'sim',
          environment: 'node',
          include: ['src/sim/**/*.test.ts'],
          // As physics: on the af-linux runner turbo runs every package's tests at once, and the 300-tick
          // re-recording and the 100 KB deflate round trips passed 5 s there (PR #20). 30 s still catches a hang.
          testTimeout: 30_000,
        },
      },
      {
        // Pre-bundle browser-side deps; on a cold cache Vite otherwise reloads test pages mid-run (A0 spec §11).
        optimizeDeps: {
          include: ['koota', 'zod', '@mcthaydt/automata-sim', '@mcthaydt/automata-sim/replay'],
        },
        test: {
          name: 'sim-browsers',
          include: ['src/sim/**/*.golden.test.ts'],
          testTimeout: 30_000, // as above, three engines at once
          browser: {
            enabled: true,
            commands: goldenCommands(),
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }, { browser: 'webkit' }, { browser: 'firefox' }],
          },
        },
      },
    ],
  },
})

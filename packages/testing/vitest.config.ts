import { svelte } from '@sveltejs/vite-plugin-svelte'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'
import { goldenCommands } from './src/sim/commands'

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
        test: { name: 'sim', environment: 'node', include: ['src/sim/**/*.test.ts'] },
      },
      {
        // Pre-bundle browser-side deps; on a cold cache Vite otherwise reloads test pages mid-run (A0 spec §11).
        optimizeDeps: {
          include: ['koota', 'zod', '@mcthaydt/automata-sim', '@mcthaydt/automata-sim/replay'],
        },
        test: {
          name: 'sim-browsers',
          include: ['src/sim/**/*.golden.test.ts'],
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

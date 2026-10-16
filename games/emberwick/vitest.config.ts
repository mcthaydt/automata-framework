import { svelte } from '@sveltejs/vite-plugin-svelte'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

// Node runs every unit test; the browsers project runs the sim golden in Chromium, WebKit and Firefox, so the
// base's sim is held to the same cross-engine rule as automata-sim itself (AGENTS.md, determinism). Svelte
// compiles the ui primitives the game package and the runtime import.
export default defineConfig({
  plugins: [svelte()],
  optimizeDeps: { include: ['koota', 'zod', 'pixi.js'] },
  test: {
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.browser.test.ts'],
        },
      },
      {
        test: {
          name: 'browsers',
          include: ['src/**/*.parity.test.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }, { browser: 'webkit' }, { browser: 'firefox' }],
          },
        },
      },
      // The renderer needs WebGL; Chromium is enough to check how it is put together (the look is checked in the
      // browser journeys and screenshots).
      {
        test: {
          name: 'renderer',
          include: ['src/**/*.browser.test.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
})

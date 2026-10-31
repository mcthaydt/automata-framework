import { svelte } from '@sveltejs/vite-plugin-svelte'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'
import { contentPlugin } from './vite.config.ts'

// Node runs every test but the screens', which run in jsdom (the dom project) or, for their layout, in the three
// browsers (the layout project); the browsers project runs the same game.test.ts, enemies.test.ts and boss.test.ts in Chromium,
// WebKit and Firefox, so the whole sim (both golden replays included, B-a) is held to the cross-engine rule (AGENTS.md,
// determinism). Svelte compiles the ui panels the game package imports (ship-config.test.ts reads the game's input
// map).
export default defineConfig({
  plugins: [svelte(), contentPlugin()],
  optimizeDeps: { include: ['zod'] },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.dom.test.ts', 'src/**/*.layout.test.ts'],
        },
      },
      // The screens on the real runtime, in jsdom (Svelte's client build, so the ui panels mount).
      {
        extends: true,
        resolve: { conditions: ['browser'] },
        test: { name: 'dom', environment: 'jsdom', include: ['src/**/*.dom.test.ts'] },
      },
      // The game's own screens' layout with production CSS in the same three engines (screens/*.layout.test.ts).
      {
        extends: true,
        resolve: { conditions: ['browser'] },
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
        test: {
          name: 'browsers',
          include: ['src/game.test.ts', 'src/enemies.test.ts', 'src/boss.test.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }, { browser: 'webkit' }, { browser: 'firefox' }],
          },
        },
      },
    ],
  },
})

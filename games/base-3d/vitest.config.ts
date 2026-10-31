import { svelte } from '@sveltejs/vite-plugin-svelte'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'
import { contentPlugin } from './vite.config.ts'

// Node runs every test but the screens', which run in jsdom (the dom project); the browsers project runs the same game.test.ts in Chromium, WebKit and Firefox, so the
// whole sim (the golden replay included, B-a) is held to the cross-engine rule (AGENTS.md, determinism). Svelte
// compiles the ui panels the game package imports (ship-config.test.ts reads the game's input map).
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
          exclude: ['src/**/*.dom.test.ts'],
        },
      },
      // The screens on the real runtime, in jsdom (Svelte's client build, so the ui panels mount).
      {
        extends: true,
        // Boot runs over Ruken's fake host, so `@mcthaydt/automata-host/target` must be the Ruken adapter (DIST spec §5.3).
        resolve: { conditions: ['automata-ruken', 'browser'] },
        test: { name: 'dom', environment: 'jsdom', include: ['src/**/*.dom.test.ts'] },
      },
      {
        test: {
          name: 'browsers',
          include: ['src/game.test.ts'],
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

import { svelte } from '@sveltejs/vite-plugin-svelte'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

// Node runs every test; the browsers project runs the same game.test.ts in Chromium, WebKit and Firefox, so the
// whole sim (the golden replay included, B-a) is held to the cross-engine rule (AGENTS.md, determinism). Svelte
// compiles the ui panels the game package imports (ship-config.test.ts reads the game's input map).
export default defineConfig({
  plugins: [svelte()],
  optimizeDeps: { include: ['zod'] },
  test: {
    projects: [
      { extends: true, test: { name: 'node', environment: 'node', include: ['src/**/*.test.ts'] } },
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

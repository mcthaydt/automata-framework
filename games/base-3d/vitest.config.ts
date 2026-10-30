import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

// Node runs every test; the browsers project runs the same game.test.ts in Chromium, WebKit and Firefox, so the
// whole sim (the golden replay included, B-a) is held to the cross-engine rule (AGENTS.md, determinism).
export default defineConfig({
  optimizeDeps: { include: ['koota', 'zod'] },
  test: {
    projects: [
      { test: { name: 'node', environment: 'node', include: ['src/**/*.test.ts'] } },
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

import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

// Node runs every unit test; the browsers project replays the golden run in Chromium, WebKit and Firefox, so
// the demo's sim is held to the same cross-engine rule as automata-sim itself (AGENTS.md, determinism).
export default defineConfig({
  optimizeDeps: { include: ['koota', 'zod'] },
  test: {
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['sim/**/*.test.ts', '*.test.ts'],
          exclude: ['**/*.parity.test.ts'],
        },
      },
      {
        test: {
          name: 'browsers',
          include: ['*.parity.test.ts'],
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

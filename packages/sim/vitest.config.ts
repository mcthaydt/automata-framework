import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Pre-bundle browser-side deps; on a cold cache Vite otherwise reloads test pages mid-run (A0 spec §11).
  optimizeDeps: { include: ['koota', 'zod'] },
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
            instances: [{ browser: 'chromium' }, { browser: 'webkit' }, { browser: 'firefox' }],
          },
        },
      },
    ],
  },
})

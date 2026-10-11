import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'node', environment: 'node', include: ['src/**/*.test.ts'] } },
      {
        test: {
          name: 'browsers',
          // Only the hash parity check runs in browsers; the compiler itself is Node build tooling.
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

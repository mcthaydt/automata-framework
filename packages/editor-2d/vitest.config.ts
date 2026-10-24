import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

// The headless core (2D editor spec §14): schema and codec round trips, grids, tools, commands and checks run in Node,
// with no renderer. The golden files (`*.parity.test.ts`) run in Node with the rest and again in Chromium, WebKit and
// Firefox, where the auto-tile hashes have to come out the same (spec G-d).
export default defineConfig({
  test: {
    projects: [
      { test: { name: 'unit', environment: 'node', include: ['src/**/*.test.ts'] } },
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

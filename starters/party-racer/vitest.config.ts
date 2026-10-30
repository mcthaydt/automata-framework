import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

// The physics package's pattern (packages/physics/vitest.config.ts): Node tests, and the parity tests again in
// Chromium, WebKit and Firefox, where the race golden must hash the same as in Node.
export default defineConfig({
  // Pre-bundle browser-side deps; on a cold cache Vite otherwise reloads test pages mid-run.
  optimizeDeps: {
    include: ['@mcthaydt/automata-sim', 'zod', '@dimforge/rapier2d-deterministic-compat'],
  },
  test: {
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          // A scripted race steps Rapier for a few thousand ticks; the shared runner runs every package at once.
          testTimeout: 90_000,
        },
      },
      {
        test: {
          name: 'browsers',
          include: ['src/**/*.parity.test.ts'],
          testTimeout: 90_000,
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

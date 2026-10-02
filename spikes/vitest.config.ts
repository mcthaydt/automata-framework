import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Pre-bundle every dependency the browser tests import. Otherwise Vite discovers them mid-run on a cold cache,
  // re-optimizes, and reloads the test pages (fails collection in Chromium/WebKit).
  optimizeDeps: {
    include: [
      'koota',
      'miniplex',
      '@dimforge/rapier2d-deterministic-compat',
      '@dimforge/rapier3d-deterministic-compat',
    ],
  },
  test: {
    testTimeout: 120_000,
    silent: false, // spike tests print measurements with console.log; Vitest hides passing-test logs by default
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['**/*.parity.test.ts', '**/*.node.test.ts'],
          provide: { engine: 'node' },
        },
      },
      {
        test: {
          name: 'browsers',
          include: ['**/*.parity.test.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [
              { browser: 'chromium', provide: { engine: 'chromium' } },
              { browser: 'webkit', provide: { engine: 'webkit' } },
              { browser: 'firefox', provide: { engine: 'firefox' } },
            ],
          },
        },
      },
    ],
  },
})

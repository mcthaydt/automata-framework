import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
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

import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

// `node` runs every test; `browsers` runs the golden replay (`*.parity.test.ts`) again in Chromium, WebKit and Firefox,
// so the sim's hash is the same in four engines (M6 spec §4.9).
export default defineConfig({
  optimizeDeps: { include: ['@automata/sim', '@automata/3d/level', 'zod'] },
  test: {
    projects: [
      { test: { name: 'node', environment: 'node', include: ['src/**/*.test.ts'], testTimeout: 90_000 } },
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

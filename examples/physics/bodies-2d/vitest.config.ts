// By path: Node loads this config without a bundler, and the package's ./sim entry uses extensionless imports.

import { goldenCommands } from '@mcthaydt/automata-testing/sim/commands'
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
          // Rapier runs hundreds of steps in some tests; the 5 s default fails them on a busy machine. 90 s, as
          // physics.
          testTimeout: 90_000,
          include: ['sim/**/*.test.ts', 'art/*.test.ts', '*.test.ts'],
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
            // bodies.replay is read through this command in a browser (browsers can read goldens, never write them).
            commands: goldenCommands(),
            instances: [{ browser: 'chromium' }, { browser: 'webkit' }, { browser: 'firefox' }],
          },
        },
      },
    ],
  },
})

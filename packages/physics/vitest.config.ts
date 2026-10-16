import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Pre-bundle browser-side deps; on a cold cache Vite otherwise reloads test pages mid-run (A0 spec §11).
  optimizeDeps: {
    include: [
      'koota',
      'zod',
      '@dimforge/rapier2d-deterministic-compat',
      '@dimforge/rapier3d-deterministic-compat',
    ],
  },
  test: {
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          // The scene tests step Rapier for 300 ticks (about 1.7 s alone). On the af-linux runner, where turbo runs
          // every package's tests at once, three of them passed 5 s, and the parity tests passed 30 s while Ruken's CI
          // ran alongside (32–33 s, 2026-10-16); 90 s still catches a hang.
          testTimeout: 90_000,
          // The bench measures and never asserts, so it is not part of the gate; `pnpm bench` runs it.
          exclude: ['src/**/*.bench.test.ts'],
        },
      },
      { test: { name: 'bench', environment: 'node', include: ['src/**/*.bench.test.ts'] } },
      {
        test: {
          name: 'browsers',
          include: ['src/**/*.parity.test.ts'],
          testTimeout: 90_000, // as above: 300-tick scenes, three engines at once
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

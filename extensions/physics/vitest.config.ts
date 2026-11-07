import { defineTests } from '@automata/vitest-preset'

export default defineTests({
  // Pre-bundle browser-side deps; on a cold cache Vite otherwise reloads test pages mid-run.
  optimizeDeps: [
    '@automata/sim',
    'zod',
    '@dimforge/rapier2d-deterministic-compat',
    '@dimforge/rapier3d-deterministic-compat',
  ],
  // The parity tests also run in Node, the fourth engine the goldens must match in.
  alsoInNode: ['tests/browser/**/*.test.ts'],
  // The scene tests step Rapier for 300 ticks (about 1.7 s alone). On the shared runner, where turbo runs every
  // package's tests at once, three of them passed 5 s and the parity tests passed 30 s; 90 s still catches a hang.
  testTimeout: 90_000,
})

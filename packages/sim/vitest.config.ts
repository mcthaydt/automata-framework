import { defineTests } from '@mcthaydt/vitest-preset'
import { goldenCommands } from './src/testing/commands.ts'

export default defineTests({
  // Pre-bundle browser-side deps; on a cold cache Vite otherwise reloads test pages mid-run (A0 spec §11).
  optimizeDeps: ['koota', 'zod'],
  // The parity tests also run in Node, the fourth engine the goldens must match in (AGENTS.md, determinism).
  alsoInNode: ['tests/browser/**/*.test.ts'],
  // The golden files browsers read (`src/testing/golden-files.ts`); a browser has no write path.
  browserCommands: goldenCommands(),
  // The 300-tick re-recording and the 100 KB deflate round trips of the golden harness passed 5 s on the shared
  // runner (PR #20). 90 s still catches a hang.
  testTimeout: 90_000,
})

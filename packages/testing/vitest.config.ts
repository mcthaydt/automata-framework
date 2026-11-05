import { goldenCommands } from '@mcthaydt/automata-testing/sim/commands'
import { defineTests } from '@mcthaydt/vitest-preset'

// unit: pure data and fixtures in jsdom; the golden and replay harness under tests/unit/sim runs in Node.
// browser: the DOM assertions against planted problems, and the goldens in three browsers, so every golden runs in
// four engines (M2.3 spec §3.8).
export default defineTests({
  environment: 'jsdom',
  svelte: true,
  alsoInNode: ['tests/browser/sim/**/*.test.ts'],
  browserCommands: goldenCommands(),
  // As physics: on the af-linux runner turbo runs every package's tests at once, and the 300-tick re-recording and
  // the 100 KB deflate round trips passed 5 s there (PR #20). 90 s still catches a hang.
  testTimeout: 90_000,
  // Pre-bundle browser-side deps; on a cold cache Vite otherwise reloads test pages mid-run (A0 spec §11).
  optimizeDeps: ['koota', 'zod', '@mcthaydt/automata-sim', '@mcthaydt/automata-sim/replay'],
})

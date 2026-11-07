import { defineTests } from '@automata/vitest-preset'

export default defineTests({
  setupFiles: ['tests/vitest-setup.ts'],
  // No browser tests: audio runs in a browser the stage starts itself.
  browsers: [],
  // The bin test starts Node and the acceptance tests start a process per paid call; the shared Mac runner runs
  // every package's tests at once, so they get the other packages' margin rather than the 5 s default.
  testTimeout: 90_000,
})

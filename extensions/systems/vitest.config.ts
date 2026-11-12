import { defineTests } from '@automataframework/vitest-preset'

export default defineTests({
  // The `requires` test builds a game with `defineGame`, and the framework's entry holds Svelte screens.
  svelte: true,
  optimizeDeps: ['@automataframework/sim', 'zod'],
  // The golden replay runs in Chromium, WebKit and Firefox, and in Node too: the sim's hash is the same in four engines.
  alsoInNode: ['tests/browser/**/*.test.ts'],
})

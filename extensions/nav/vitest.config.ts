import { defineTests } from '@automata/vitest-preset'

export default defineTests({
  optimizeDeps: ['@automata/sim', 'zod'],
  // The golden replay runs in Chromium, WebKit and Firefox, and in Node too: the sim's hash is the same in four engines.
  alsoInNode: ['tests/browser/**/*.test.ts'],
})

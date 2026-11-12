import { defineTests } from '@automataframework/vitest-preset'

export default defineTests({
  optimizeDeps: ['@automataframework/sim', '@automataframework/3d/level', 'zod'],
  // The golden replay runs in Chromium, WebKit and Firefox, and in Node too: the sim's hash is the same in four engines.
  alsoInNode: ['tests/browser/**/*.test.ts'],
})

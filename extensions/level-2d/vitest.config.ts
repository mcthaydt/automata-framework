import { defineTests } from '@automataframework/vitest-preset'

// Level-2d is sim code and pure maths. Its one browser suite is the golden: a guard on a flat level hashes the same in
// Chromium, WebKit and Firefox, and in Node too.
export default defineTests({
  optimizeDeps: ['@automataframework/sim', 'zod'],
  alsoInNode: ['tests/browser/**/*.test.ts'],
})

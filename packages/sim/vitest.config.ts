import { defineTests } from '@mcthaydt/vitest-preset'

export default defineTests({
  // Pre-bundle browser-side deps; on a cold cache Vite otherwise reloads test pages mid-run (A0 spec §11).
  optimizeDeps: ['koota', 'zod'],
  // The parity tests also run in Node, the fourth engine the goldens must match in (AGENTS.md, determinism).
  alsoInNode: ['tests/browser/**/*.test.ts'],
})

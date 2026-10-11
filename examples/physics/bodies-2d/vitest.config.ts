import { defineConfig } from 'vitest/config'

// The demo's sim half in Node: the bodies fall, follow and drop as main.ts relies on.
export default defineConfig({
  optimizeDeps: { include: ['koota', 'zod'] },
  test: { environment: 'node', include: ['sim/**/*.test.ts'] },
})

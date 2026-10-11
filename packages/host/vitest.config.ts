import { defineConfig } from 'vitest/config'

// Node by default; a test that needs a DOM opts in with `// @vitest-environment jsdom`.
export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})

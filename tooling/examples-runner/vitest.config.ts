import { defineConfig } from 'vitest/config'

// Node runs the runner's unit tests. src/fixtures/ holds example files, not tests.
export default defineConfig({
  test: {
    projects: [{ test: { name: 'node', environment: 'node', include: ['src/**/*.test.ts'] } }],
  },
})

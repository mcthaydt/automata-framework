import { defineConfig } from 'vitest/config'

// The format and the codec are pure functions over text, so every test runs on Node.
export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})

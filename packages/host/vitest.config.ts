import { defineConfig } from 'vitest/config'

// Every test runs on Node: the fake Ruken host talks to the real SDK over in-memory ports.
export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})

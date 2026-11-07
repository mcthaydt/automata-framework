import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'node',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // The bin and integration tests start Node and real git; the shared Mac runner runs every package's tests at
    // once, so they get the other packages' margin rather than the 5 s default.
    testTimeout: 90_000,
  },
})

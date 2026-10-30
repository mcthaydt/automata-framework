import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'node',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // The link tests step TestClock through hundreds of milliseconds; the shared Mac runner runs every package's tests
    // at once, so they get physics's margin rather than the 5 s default (a hang still fails).
    testTimeout: 90_000,
  },
})

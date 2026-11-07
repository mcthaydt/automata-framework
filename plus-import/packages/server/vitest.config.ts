import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'node',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // The Colyseus suite boots a real server and real sockets per test; the shared Mac runner runs every package's
    // tests at once, so it gets net's margin rather than the 5 s default (a hang still fails).
    testTimeout: 90_000,
    hookTimeout: 90_000,
  },
})

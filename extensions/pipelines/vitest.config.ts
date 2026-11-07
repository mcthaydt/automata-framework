import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'node',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // The bin test starts Node and the acceptance tests start a process per paid call; the shared Mac runner runs
    // every package's tests at once, so they get the other packages' margin rather than the 5 s default.
    testTimeout: 90_000,
    // The bins run from source, and the core packages under them are TypeScript with parameter properties, which
    // type stripping alone refuses; the tests start the bins with the flag the bins' own shebang carries.
    env: { NODE_OPTIONS: '--experimental-transform-types --disable-warning=ExperimentalWarning' },
  },
})

import { defineConfig } from 'vitest/config'

// The install suite: real `claude` and `npx skills` installs in a throwaway config folder. Needs the `claude` CLI on
// PATH, the npm registry, and PLAYWRIGHT_BROWSERS_PATH (the hook runs base-2d's tests, browser projects included).
// Not silent: each command and its output is the install log.
export default defineConfig({
  test: {
    silent: false,
    include: ['src/install.test.ts'],
    testTimeout: 300_000,
    hookTimeout: 300_000,
    fileParallelism: false,
  },
})

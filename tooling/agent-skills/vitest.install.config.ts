import { defineConfig } from 'vitest/config'

// The install suite: real `claude` and `npx skills` installs in throwaway config folders, then the installed hook run
// in a game made from the packs. Needs the `claude` CLI on PATH, the npm registry and packages built by `pnpm build`.
// Not silent: each command and its output is the install log.
export default defineConfig({
  test: {
    silent: false,
    include: ['tests/install/install.test.ts'],
    testTimeout: 300_000,
    hookTimeout: 300_000,
    fileParallelism: false,
  },
})

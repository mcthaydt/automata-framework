import { defineConfig } from 'vitest/config'

// The install suite (install.test.ts) needs the `claude` CLI and the npm registry, so it runs only through
// `test:install` (vitest.install.config.ts), never in `pnpm check`.
export default defineConfig({
  test: { include: ['src/**/*.test.ts'], exclude: ['src/install.test.ts'], testTimeout: 30_000 },
})

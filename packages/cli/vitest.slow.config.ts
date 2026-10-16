import { defineConfig } from 'vitest/config'

// The Chromium suites left out of the default run (vitest.config.ts): `pnpm --filter @mcthaydt/automata-cli test:slow`.
export default defineConfig({
  test: { include: ['src/**/*.slow.test.ts'] },
})

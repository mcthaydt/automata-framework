import { defineConfig } from 'vitest/config'

// The Chromium suites left out of the default run (they need Playwright's browsers):
// `pnpm --filter @mcthaydt/automata-tools test:slow`.
export default defineConfig({ test: { include: ['tests/slow/**/*.test.ts'] } })

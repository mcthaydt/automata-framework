import { defineConfig } from 'vitest/config'

// fixtures/ holds files named like tests (to check that the CLI skips them); they are not tests.
export default defineConfig({ test: { include: ['src/**/*.test.ts'] } })

import { defineConfig } from 'vitest/config'

// fixtures/ holds a tiny built workspace (package.json files and .d.ts), not tests.
export default defineConfig({ test: { include: ['src/**/*.test.ts'] } })

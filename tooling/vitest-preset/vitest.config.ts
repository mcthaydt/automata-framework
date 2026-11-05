import { defineConfig } from 'vitest/config'

// The preset cannot configure its own tests, so this one config is written out by hand.
export default defineConfig({ test: { include: ['tests/unit/**/*.test.ts'] } })

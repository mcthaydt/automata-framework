import { defineConfig } from 'vitest/config'

// tests/fixtures holds a small package the codemod is run on (copied to a temp folder first); it is not a test.
export default defineConfig({ test: { include: ['tests/unit/**/*.test.ts'] } })

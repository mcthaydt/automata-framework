import { defineConfig } from 'vitest/config'

// The sector format is pure data and Zod schemas, so its tests run in Node only. It has no sim of its own: the
// sim packages that import it (through its declared sim entry) prove their determinism in their own parity suites.
export default defineConfig({ test: { environment: 'node', include: ['src/**/*.test.ts'] } })

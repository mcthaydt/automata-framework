import { defineConfig } from 'vitest/config'

// The room schema in Node: the compiler gets the base's message and the row it is about.
export default defineConfig({ test: { environment: 'node', include: ['*.test.ts'] } })

import { defineConfig } from 'vitest/config'

// The runs left out of the default one for their length: `pnpm --filter @automataframework/character-kit test:slow`.
export default defineConfig({ test: { include: ['tests/slow/**/*.test.ts'] } })

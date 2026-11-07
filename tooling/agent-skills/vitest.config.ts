import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const repo = (path: string) => fileURLToPath(new URL(`../../${path}`, import.meta.url))

// The automata-feature skill's worked example sits in the skill folder, laid out like a new game's feature. It is
// tested here, against this repo's sim source, so the code an agent copies from the skill is code that passes.
// The install suite (tests/install/install.test.ts) needs the `claude` CLI and the npm registry, so it runs only through
// `test:install` (vitest.install.config.ts), never in `pnpm check`.
export default defineConfig({
  resolve: {
    alias: { '@automata/sim': repo('packages/sim/src/entries/index.ts') },
  },
  test: {
    dir: repo('.'),
    include: [
      'tooling/agent-skills/tests/unit/**/*.test.ts',
      'agents/automata/skills/*/example/**/*.test.ts',
    ],
    exclude: ['**/node_modules/**'],
    testTimeout: 30_000,
  },
})

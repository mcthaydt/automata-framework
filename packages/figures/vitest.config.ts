import { defineConfig } from 'vitest/config'

// figures is renderer-free (M3 spec §4.4): the rig, the genes and the content checks are pure functions, so
// every test runs on Node in the one `unit` project. The solve bench (M3.6a, S7-Q8) measures and never
// asserts, so it is not part of the gate; `pnpm bench` runs it.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.bench.test.ts'],
        },
      },
      { test: { name: 'bench', environment: 'node', include: ['src/**/*.bench.test.ts'] } },
    ],
  },
})

import { defineConfig } from 'vitest/config'

// figures is renderer-free (M3 spec §4.4): the rig, the genes and the content checks are pure functions, so
// every test runs on Node in the one `unit` project.
export default defineConfig({
  test: {
    projects: [{ test: { name: 'unit', environment: 'node', include: ['src/**/*.test.ts'] } }],
  },
})

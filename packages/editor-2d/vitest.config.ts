import { defineConfig } from 'vitest/config'

// The headless core (2D editor spec §14): schema and codec round trips, grids, commands and checks run in Node,
// with no renderer. The browser parity project that runs the auto-tile golden in WebKit and Firefox joins in ED2D.2.
export default defineConfig({
  test: {
    projects: [{ test: { name: 'unit', environment: 'node', include: ['src/**/*.test.ts'] } }],
  },
})

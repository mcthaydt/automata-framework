import { defineConfig } from 'vitest/config'

// Feel is presentation only: no sim entry and no golden, so Node runs every test (the F-b test compares sim hashes itself).
export default defineConfig({
  optimizeDeps: { include: ['@mcthaydt/automata-sim', 'zod'] },
  test: { environment: 'node', include: ['src/**/*.test.ts'], testTimeout: 90_000 },
})

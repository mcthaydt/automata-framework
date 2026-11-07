import { defineConfig } from 'vitest/config'

// audio-synth is presentation only: no sim entry and no golden, so Node runs every test.
export default defineConfig({
  optimizeDeps: { include: ['@mcthaydt/automata-sim', 'zod'] },
  test: { environment: 'node', include: ['src/**/*.test.ts'], testTimeout: 90_000 },
})

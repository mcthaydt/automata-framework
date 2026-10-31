import { svelte } from '@sveltejs/vite-plugin-svelte'
import { svelteTesting } from '@testing-library/svelte/vite'
import { defineConfig } from 'vitest/config'

// Debug is presentation only: no sim entry and no golden. Components run in jsdom through Testing Library; the release bundle
// test (DB-b) builds a fixture with Vite from inside Node.
export default defineConfig({
  plugins: [svelte(), svelteTesting()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/vitest-setup.ts'],
    testTimeout: 90_000,
  },
})

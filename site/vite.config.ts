import { sveltekit } from '@sveltejs/kit/vite'
import { svelteTesting } from '@testing-library/svelte/vite'
import { defineConfig } from 'vitest/config'
import { playgroundDevHeaders } from './scripts/playground-dev-headers'

export default defineConfig({
  plugins: [sveltekit(), svelteTesting(), playgroundDevHeaders()],
  resolve: {
    conditions: ['browser'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    // The default 5 s is too tight for the docs and homepage renders on a loaded runner (three of them timed out
    // in the QB.3 run); a real hang still fails, 30 s later.
    testTimeout: 30_000,
  },
})

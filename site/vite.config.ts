import { sveltekit } from '@sveltejs/kit/vite'
import { svelteTesting } from '@testing-library/svelte/vite'
import { defineConfig } from 'vitest/config'
import { playgroundDevHeaders } from './scripts/playground-dev-headers.ts'
import { frameworkData } from './src/shared/framework/vite-plugin.ts'

export default defineConfig({
  plugins: [frameworkData(), sveltekit(), svelteTesting(), playgroundDevHeaders()],
  resolve: {
    conditions: ['browser'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    // The default 5 s is too tight for the docs and homepage renders on a loaded runner (three of them timed out
    // in the QB.3 run); a real hang still fails, 30 s later.
    testTimeout: 30_000,
    // The playground's journeys are Playwright's (playground/playwright.config.ts), not Vitest's.
    exclude: ['**/node_modules/**', 'tests/playground/e2e/**'],
  },
})

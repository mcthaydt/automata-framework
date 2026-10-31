import { svelte } from '@sveltejs/vite-plugin-svelte'
import { svelteTesting } from '@testing-library/svelte/vite'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

// Three projects: `node` (the wire, the client, the session, the link tests), `ui` (the badge and overlay's behaviour in jsdom
// through Testing Library) and `layout` (production CSS at the reference sizes in real Chromium, WebKit and Firefox, M7 spec §8).
export default defineConfig({
  plugins: [svelte(), svelteTesting()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/ui/**', '**/node_modules/**'],
          // The link tests step TestClock through hundreds of milliseconds; the shared Mac runner runs every package's tests
          // at once, so they get physics's margin rather than the 5 s default (a hang still fails).
          testTimeout: 90_000,
        },
      },
      {
        extends: true,
        test: {
          name: 'ui',
          environment: 'jsdom',
          include: ['src/ui/**/*.test.ts'],
          exclude: ['src/ui/**/*.layout.test.ts'],
          setupFiles: ['./src/ui/vitest-setup.ts'],
          css: true,
        },
      },
      {
        extends: true,
        // Svelte's client build, as in the ui package.
        resolve: { conditions: ['browser'] },
        test: {
          name: 'layout',
          include: ['src/ui/**/*.layout.test.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }, { browser: 'webkit' }, { browser: 'firefox' }],
          },
        },
      },
    ],
  },
})

import { svelte } from '@sveltejs/vite-plugin-svelte'
import { svelteTesting } from '@testing-library/svelte/vite'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

// Debug is presentation only: no sim entry and no golden. `jsdom` runs the components through Testing Library, and the release
// bundle test (DB-b) builds a fixture with Vite from inside Node. `browsers` (DBG-L) lays the overlay out in real Chromium,
// which jsdom cannot do; the file name `*.browser.test.ts` keeps those out of the jsdom run.
export default defineConfig({
  plugins: [svelte(), svelteTesting()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.browser.test.ts'],
          setupFiles: ['./src/vitest-setup.ts'],
          testTimeout: 90_000,
        },
      },
      {
        extends: true,
        // Svelte's package exports pick the server build unless the browser condition is set; the jsdom project gets it from svelteTesting.
        resolve: { conditions: ['browser'] },
        test: {
          name: 'browsers',
          include: ['src/**/*.browser.test.ts'],
          testTimeout: 90_000,
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
})

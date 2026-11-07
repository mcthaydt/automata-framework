import { svelte } from '@sveltejs/vite-plugin-svelte'
import { svelteTesting } from '@testing-library/svelte/vite'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

// Two projects, as core's ui package has: `unit` runs each screen's states and behavior in jsdom through Testing Library; `layout`
// runs the layout contract with production CSS in real Chromium, WebKit and Firefox at every reference size (M1.6 spec §7).
export default defineConfig({
  plugins: [svelte(), svelteTesting()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.layout.test.ts'],
          setupFiles: ['./src/vitest-setup.ts'],
          css: true,
          testTimeout: 90_000,
        },
      },
      {
        extends: true,
        // Svelte's client build: `mountFixture` comes through the testing package, which Vite would otherwise resolve to the server entry.
        resolve: { conditions: ['browser'] },
        test: {
          name: 'layout',
          include: ['src/**/*.layout.test.ts'],
          testTimeout: 90_000,
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

import { svelte } from '@sveltejs/vite-plugin-svelte'
import { svelteTesting } from '@testing-library/svelte/vite'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

// Two projects (M7 spec §8): `ui` (the badge and overlay's behaviour in jsdom through Testing Library) and `layout` (production CSS at
// the reference sizes in real Chromium, WebKit and Firefox).
export default defineConfig({
  plugins: [svelte(), svelteTesting()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'ui',
          environment: 'jsdom',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.layout.test.ts'],
          setupFiles: ['./src/vitest-setup.ts'],
          css: true,
        },
      },
      {
        extends: true,
        // Svelte's client build, as in the ui package.
        resolve: { conditions: ['browser'] },
        test: {
          name: 'layout',
          include: ['src/**/*.layout.test.ts'],
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

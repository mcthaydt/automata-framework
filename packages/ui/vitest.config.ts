import { svelte } from '@sveltejs/vite-plugin-svelte'
import { svelteTesting } from '@testing-library/svelte/vite'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

// Two projects (M1.6 spec §7):
// - unit: logic and component behavior in jsdom, through Testing Library (states and behavior, no snapshots).
// - layout: layout contracts with production CSS in real Chromium, WebKit and Firefox at every reference size.
export default defineConfig({
  plugins: [svelte(), svelteTesting()],
  optimizeDeps: { include: ['nanostores'] },
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
          // Real CSS, so the theme test reads theme.css and components carry their styles.
          css: true,
        },
      },
      {
        extends: true,
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

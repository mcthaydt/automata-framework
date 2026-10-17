import { svelte } from '@sveltejs/vite-plugin-svelte'
import { svelteTesting } from '@testing-library/svelte/vite'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

// Two projects (DX spec §8):
// - unit: defineGame, keys(), the default screens' states and focus, and startGame's boot, in jsdom.
// - layout: the default screens' layout contract with production CSS in Chromium, WebKit and Firefox at every
//   reference size and variant (M1.6 spec §7).
// - browsers: what the game package draws, on a real WebGL2 renderer in the same three engines (PRODUCT.2).
export default defineConfig({
  plugins: [svelte(), svelteTesting()],
  test: {
    projects: [
      {
        extends: true,
        // Svelte's client build, so `mount` works in jsdom (the default resolves its server entry).
        resolve: { conditions: ['browser'] },
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.layout.test.ts', 'src/**/*.parity.test.ts'],
          setupFiles: ['./src/vitest-setup.ts'],
          css: true,
        },
      },
      {
        extends: true,
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
      {
        extends: true,
        resolve: { conditions: ['browser'] },
        test: {
          name: 'browsers',
          include: ['src/**/*.parity.test.ts'],
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

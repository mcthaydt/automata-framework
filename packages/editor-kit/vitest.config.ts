import { svelte } from '@sveltejs/vite-plugin-svelte'
import { svelteTesting } from '@testing-library/svelte/vite'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

// Two projects (editor kit spec §8), the same split as @mcthaydt/automata-ui:
// - unit: pure rules and component behavior in jsdom, through Testing Library (states and behavior, no snapshots).
// - layout: the shell's layout contract with production CSS in a real browser at the sizes in spec §7.
//   WebKit and Firefox join in EDK.6; until then they run through a test-request on the Orchestrator bus.
export default defineConfig({
  plugins: [svelte(), svelteTesting()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
          exclude: ['src/**/*.layout.test.ts'],
          setupFiles: ['./src/vitest-setup.ts'],
          css: true,
        },
      },
      {
        extends: true,
        // Svelte's client build: the fixtures mount through the testing package.
        resolve: { conditions: ['browser'] },
        test: {
          name: 'layout',
          include: ['src/**/*.layout.test.ts'],
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

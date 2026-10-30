import { svelte } from '@sveltejs/vite-plugin-svelte'
import { svelteTesting } from '@testing-library/svelte/vite'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

// Three projects (editor suite spec §12):
// - unit: the headless core and the shell's models in Node: no Svelte, no DOM.
// - dom: Svelte components in jsdom through Testing Library (states and behaviour, no snapshots). `*.dom.test.ts`.
// - layout: the production CSS in real Chromium, WebKit and Firefox at the sizes of spec §10. `*.layout.test.ts`.
// The Svelte plugins sit on the two projects that mount components, as in editor-2d.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.dom.test.ts', 'src/**/*.layout.test.ts'],
        },
      },
      {
        plugins: [svelte(), svelteTesting()],
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['src/**/*.dom.test.ts'],
          setupFiles: ['./src/vitest-setup.ts'],
          css: true,
        },
      },
      {
        plugins: [svelte(), svelteTesting()],
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

import { svelte } from '@sveltejs/vite-plugin-svelte'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

// Three projects (M1.5 spec §7, §9):
// - unit: every behavior test, in jsdom because boot and the page layers mount ui's Svelte components.
// - bench: the frame-loop overhead check in Node, kept out of the gate (it is a measurement, not a test).
// - bench-chromium: the same check in real Chromium, where requestAnimationFrame and the JIT are the shipped ones.
export default defineConfig({
  plugins: [svelte()],
  test: {
    projects: [
      {
        extends: true,
        // Svelte's client build, so `mount` works in jsdom (the default resolves its server entry).
        resolve: { conditions: ['browser'] },
        test: {
          name: 'unit',
          environment: 'jsdom',
          // Compiles the Paraglide fixture once, in Node (src/locale/testing/global-setup.ts).
          globalSetup: ['src/locale/testing/global-setup.ts'],
          // The fixture lives under node_modules/.cache; transform all of it through Vite, so its messages and
          // its runtime are one module graph and overwriteGetLocale reaches the messages (live bindings).
          server: { deps: { inline: [/af-paraglide-fixture/] } },
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.bench.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'bench',
          environment: 'node',
          include: ['src/**/*.bench.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'bench-chromium',
          include: ['src/**/*.bench.test.ts'],
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

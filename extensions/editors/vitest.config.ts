import { defineTests } from '@automata/vitest-preset'
import { svelteTesting } from '@testing-library/svelte/vite'
import { playwright } from '@vitest/browser-playwright'

// The editors' models and components run in jsdom through Testing Library (`unit`); their layout runs in a real browser.
export default defineTests({
  environment: 'jsdom',
  svelte: true,
  plugins: [svelteTesting()],
  setupFiles: ['./tests/vitest-setup.ts'],
  css: true,
  // The layout of each editor in the suite's shell, in real browsers (tests/browser/layout).
  // Every engine runs it with a mouse; Chromium runs it again with touch, where the 44 px rule holds.
  browserProjects: [
    {
      name: 'layout',
      folder: 'layout',
      engines: ['chromium', 'webkit', 'firefox'],
      instance: (engine) =>
        engine === 'chromium'
          ? [
              { browser: engine },
              {
                browser: engine,
                name: 'layout (chromium, touch)',
                provider: playwright({ contextOptions: { hasTouch: true } }),
              },
            ]
          : { browser: engine },
    },
  ],
})

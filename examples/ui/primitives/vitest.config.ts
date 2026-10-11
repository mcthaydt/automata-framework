import { playwright } from '@vitest/browser-playwright'
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

// The smoke test boots the demo in Chromium (examples convention: boots, ready, no console errors).
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      include: ['src/**/*.smoke.test.ts'],
      browser: {
        enabled: true,
        headless: true,
        provider: playwright(),
        instances: [{ browser: 'chromium' }],
      },
    },
  }),
)

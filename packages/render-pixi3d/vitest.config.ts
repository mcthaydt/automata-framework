import { svelte } from '@sveltejs/vite-plugin-svelte'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

// `node`: the parsers, the views' maths, the no-eval shim's pin and the bundle guard. `browsers`: the renderer on a
// real WebGL2 context (`*.parity.test.ts`). Headless Firefox in this container has no WebGL, so those cases skip
// there and the GPU runner runs them (M3.1b). Svelte compiles the runtime's screens, which its entry reaches.
export default defineConfig({
  plugins: [svelte()],
  test: {
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.parity.test.ts'],
        },
      },
      {
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

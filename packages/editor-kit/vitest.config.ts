import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { svelteTesting } from '@testing-library/svelte/vite'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

// Two projects (editor kit spec §8), the same split as @mcthaydt/automata-ui:
// - unit: pure rules and component behavior in jsdom, through Testing Library (states and behavior, no snapshots).
// - layout: the shell, widget and storage contracts with production CSS in real Chromium, WebKit and Firefox at the
//   sizes in spec §7 (EDK.6a).
//
// WebKit runs in a persistent profile: Playwright's default WebKit context is ephemeral, like a private window, and
// there `navigator.storage.getDirectory()` rejects with an UnknownError, so the real-OPFS contract could never run
// (the workspace falls back to memory, as EK-f says it should). A persistent context is ignored when files run in
// parallel, so WebKit runs its files one at a time. The profile is new for every run (the process id), so no run
// sees another's files or databases.
const webkitProfile = join(tmpdir(), `af-editor-kit-webkit-${process.pid}`)
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
            instances: [
              { browser: 'chromium' },
              {
                browser: 'webkit',
                provider: playwright({ persistentContext: webkitProfile }),
                fileParallelism: false,
              },
              { browser: 'firefox' },
            ],
          },
        },
      },
    ],
  },
})

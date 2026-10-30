import { mkdtempSync } from 'node:fs'
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
// Chromium and WebKit run in a persistent profile, because each refuses part of the real storage contract in
// Playwright's default context, which is ephemeral (off the record, like a private window):
// - WebKit rejects `navigator.storage.getDirectory()` with an UnknownError, so the workspace falls back to memory
//   (EK-f) and the real-OPFS contract never runs.
// - Chromium 153 crashes (SIGTRAP) reading a directory handle back from IndexedDB, the folder vault's `load`.
//   Chromium 141, on which EDK.5 landed, did not.
// Vitest ignores a persistent context when files run in parallel, so these two run their files one at a time. The
// profiles live in one new temporary directory per run, removed by `vitest.global-teardown.ts`, so no run sees
// another's files or databases. WebKit also runs once in the ephemeral context, on the private-window test alone,
// so EK-f's fallback is exercised in a real engine.
const PRIVATE_WINDOW = 'src/storage/private-window.layout.test.ts'
process.env.AF_EDITOR_KIT_PROFILES ??= mkdtempSync(join(tmpdir(), 'af-editor-kit-layout-'))
const profiles = process.env.AF_EDITOR_KIT_PROFILES

function persistentProfile(browser: 'chromium' | 'webkit') {
  return {
    browser,
    provider: playwright({ persistentContext: join(profiles, browser) }),
    fileParallelism: false,
    exclude: [PRIVATE_WINDOW],
  }
}

export default defineConfig({
  plugins: [svelte(), svelteTesting()],
  test: {
    globalSetup: ['./vitest.global-teardown.ts'],
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
              persistentProfile('chromium'),
              persistentProfile('webkit'),
              { browser: 'firefox', exclude: [PRIVATE_WINDOW] },
              { browser: 'webkit', name: 'layout (webkit, private window)', include: [PRIVATE_WINDOW] },
            ],
          },
        },
      },
    ],
  },
})

import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { journeyInstance } from '@mcthaydt/automata-editor/kit/journey-project'
import { defineTests } from '@mcthaydt/vitest-preset'
import { svelteTesting } from '@testing-library/svelte/vite'
import { playwright } from '@vitest/browser-playwright'
import { removeProfiles } from './scripts/remove-profiles.ts'

// Unit tests run in Node unless a file's first line says `// @vitest-environment jsdom`; they compile Svelte and mount
// components through Testing Library. The browser tests are one project per folder of `tests/browser/` (the preset).
//
// The storage tests run in a persistent profile in Chromium and WebKit, because each refuses part of the real storage
// contract in Playwright's default context, which is ephemeral (off the record, like a private window):
// - WebKit rejects `navigator.storage.getDirectory()` with an UnknownError, so the workspace falls back to memory and
//   the real-OPFS contract never runs.
// - Chromium 153 crashes (SIGTRAP) reading a directory handle back from IndexedDB, the folder vault's `load`.
// Vitest ignores a persistent context when files run in parallel, so these run their files one at a time. The profiles
// live in one new temporary directory per run, removed when the process exits, after every browser is gone (and a failed
// removal never fails the run). WebKit also runs once in the ephemeral context, on the private-window test alone, so the
// memory fallback is exercised in a real engine.
const PRIVATE_WINDOW = 'tests/browser/storage/private-window.test.ts'
const profiles = mkdtempSync(join(tmpdir(), 'af-editor-storage-'))
process.once('exit', () => removeProfiles(profiles))

const persistent = (browser: 'chromium' | 'webkit') => ({
  browser,
  provider: playwright({ persistentContext: join(profiles, browser) }),
  fileParallelism: false,
  exclude: [PRIVATE_WINDOW],
})

export default defineTests({
  environment: 'node',
  svelte: true,
  plugins: [svelteTesting()],
  setupFiles: ['./tests/fixtures/setup.ts'],
  css: true,
  // The auto-tile goldens also run in Node, the fourth engine the hashes must agree in.
  alsoInNode: ['tests/browser/parity/**/*.test.ts'],
  browserProjects: [
    { name: 'parity', folder: 'parity', engines: ['chromium', 'webkit', 'firefox'] },
    { name: 'layout', folder: 'layout', engines: ['chromium', 'webkit', 'firefox'] },
    {
      name: 'storage',
      folder: 'storage',
      engines: ['chromium', 'webkit', 'firefox'],
      instance: (engine) => {
        if (engine === 'firefox') return { browser: engine, exclude: [PRIVATE_WINDOW] }
        if (engine === 'chromium') return persistent(engine)
        return [
          persistent(engine),
          { browser: engine, name: 'storage (webkit, private window)', include: [PRIVATE_WINDOW] },
        ]
      },
    },
    { name: 'canvas', folder: 'canvas', engines: ['chromium', 'webkit'] },
    {
      name: 'journeys',
      folder: 'journeys',
      engines: ['webkit', 'chromium'],
      instance: journeyInstance(playwright),
    },
  ],
})

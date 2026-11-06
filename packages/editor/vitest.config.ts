import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { journeyProject } from '@mcthaydt/automata-editor/kit/journey-project'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { svelteTesting } from '@testing-library/svelte/vite'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'
import { removeProfiles } from './scripts/remove-profiles.ts'

// The tests still sit beside the code they test; task 4.3 moves them to `tests/` and replaces this file with the
// repository's `defineTests` preset. Until then the three old packages' projects are kept, told apart by folder
// (the kit's tests run in jsdom; the editor's and the suite's run in Node unless their name says `.dom`).
//
// Chromium and WebKit run the kit's layout tests in a persistent profile, because each refuses part of the real storage
// contract in Playwright's default context, which is ephemeral (off the record, like a private window):
// - WebKit rejects `navigator.storage.getDirectory()` with an UnknownError, so the workspace falls back to memory and
//   the real-OPFS contract never runs.
// - Chromium 153 crashes (SIGTRAP) reading a directory handle back from IndexedDB, the folder vault's `load`.
// Vitest ignores a persistent context when files run in parallel, so these run their files one at a time. The profiles
// live in one new temporary directory per run, removed by `vitest.global-teardown.ts`. WebKit also runs once in the
// ephemeral context, on the private-window test alone, so the memory fallback is exercised in a real engine.
const PRIVATE_WINDOW = 'src/shared/kit/storage/private-window.layout.test.ts'
process.env.AF_EDITOR_KIT_PROFILES ??= mkdtempSync(join(tmpdir(), 'af-editor-kit-layout-'))
const profiles = process.env.AF_EDITOR_KIT_PROFILES
// Whatever loads this file (a unit run, knip) leaves no directory behind: removed again when the process exits, after
// every browser is gone.
process.once('exit', () => removeProfiles(profiles))

function persistentProfile(browser: 'chromium' | 'webkit') {
  return {
    browser,
    provider: playwright({ persistentContext: join(profiles, browser) }),
    fileParallelism: false,
    exclude: [PRIVATE_WINDOW],
  }
}

const KIT = 'src/shared/kit/**/*.test.ts'
const KIT_SUPPORT = [
  'src/entries/kit.test.ts',
  'src/testing/kit/**/*.test.ts',
  'src/testing/ports/**/*.test.ts',
  'scripts/**/*.test.ts',
]
const NOT_UNIT = ['**/*.dom.test.ts', '**/*.layout.test.ts', '**/*.canvas.test.ts', '**/*.journey.test.ts']
const browserInstances = (...names: ('chromium' | 'webkit' | 'firefox')[]) =>
  names.map((browser) => ({ browser }))
const components = [svelte(), svelteTesting()]
// Svelte's client build: the fixtures mount through the testing package.
const clientBuild = { conditions: ['browser'] }

export default defineConfig({
  test: {
    globalSetup: ['./vitest.global-teardown.ts'],
    projects: [
      {
        // The kit's tests, which mount components and so run in jsdom, with the production CSS.
        plugins: components,
        test: {
          name: 'kit',
          environment: 'jsdom',
          include: [KIT, ...KIT_SUPPORT],
          exclude: NOT_UNIT,
          setupFiles: ['./tests/fixtures/setup.ts'],
          css: true,
        },
      },
      {
        // The headless layers import no component, so there is no Svelte plugin here: with one, the testing package's
        // `browser` condition would make the code parser of the architecture test load its WebAssembly build in Node.
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: [...NOT_UNIT, KIT, ...KIT_SUPPORT],
        },
      },
      {
        plugins: components,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['src/**/*.dom.test.ts'],
          setupFiles: ['./tests/fixtures/setup.ts'],
          css: true,
        },
      },
      {
        plugins: components,
        resolve: clientBuild,
        test: {
          name: 'layout',
          include: ['src/**/*.layout.test.ts'],
          exclude: ['src/shared/kit/**'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: browserInstances('chromium', 'webkit', 'firefox'),
          },
        },
      },
      {
        plugins: components,
        resolve: clientBuild,
        test: {
          name: 'layout-kit',
          include: ['src/shared/kit/**/*.layout.test.ts'],
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
      {
        plugins: components,
        resolve: clientBuild,
        // Every dependency the canvas tests load is bundled before the first test: one found mid-run makes Vite reload
        // the page, and the run fails. Listing the test files as entries lets Vite find them all up front.
        optimizeDeps: {
          entries: ['src/**/*.canvas.test.ts'],
          include: ['pixi.js', 'svelte/store', '@testing-library/svelte'],
        },
        test: {
          name: 'canvas',
          include: ['src/**/*.canvas.test.ts'],
          provide: { writeVisuals: process.env.ED2D_VISUALS === '1' },
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: browserInstances('chromium', 'webkit'),
          },
        },
      },
      {
        // The auto-tile goldens: they run in Node with `unit` and again in every engine, where the hashes must match.
        test: {
          name: 'browsers',
          include: ['src/**/*.parity.test.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: browserInstances('chromium', 'webkit', 'firefox'),
          },
        },
      },
      // The iPad journeys: WebKit with touch and a 2x screen.
      {
        ...journeyProject(playwright, {
          include: ['src/**/*.journey.test.ts', 'tests/browser/journeys/**/*.journey.test.ts'],
        }),
        plugins: components,
      },
    ],
  },
})

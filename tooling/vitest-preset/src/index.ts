// One Vitest config shape for every package and game (core and 2D refactor spec, section 3.4).
//
// A package's tests sit in `tests/`, and the folder says what kind a test is:
//   tests/unit/     Node, or jsdom when the package's default says so (one file can override it with a
//                   vitest-environment comment on its first line)
//   tests/browser/  Vitest browser mode, in real Chromium, WebKit and Firefox (parity, layout, goldens). A package with
//                   kinds of browser test that need different engines or contexts splits it into named folders
//                   (`tests/browser/layout/`, `tests/browser/journeys/`): see `browserProjects`.
//   tests/bench/    timings, run by `pnpm bench` only (AF_BENCH=1), never in a gate
// A package's `vitest.config.ts` is one call: `export default defineTests({ ... })`. The options are what the old
// per-package configs differed by, and nothing more.
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { playwright } from '@vitest/browser-playwright'
import type { PluginOption } from 'vite'
import type { ViteUserConfig } from 'vitest/config'
import type { BrowserCommand } from 'vitest/node'

import { BROWSER_ENGINES, type Engine } from './engines.ts'

export type { Engine }

/** One Vitest browser instance: an engine, and whatever Vitest takes beside it (a provider, a viewport, `include`). */
export interface BrowserInstance {
  readonly browser: Engine
  readonly [option: string]: unknown
}

/** One kind of browser test: the files in `tests/browser/<folder>/`, run as one Vitest project. */
export interface BrowserProject {
  /** The project's name, as `--project` takes it (`layout`). Two projects may not share one. */
  readonly name: string
  /** The folder under `tests/browser/`. */
  readonly folder: string
  /** The engines this kind of test runs in (a canvas test needs no Firefox, a journey runs in WebKit first). */
  readonly engines: readonly Engine[]
  /**
   * The instance for an engine, when it is more than `{ browser }`: a persistent profile, an iPad context. It may return
   * several, so one engine can run once with a profile and once without.
   */
  readonly instance?: (engine: Engine) => BrowserInstance | readonly BrowserInstance[]
}

export interface TestOptions {
  /** What `tests/unit` runs in. Node unless the package's tests mostly need a DOM. */
  readonly environment?: 'node' | 'jsdom'
  /** Run before every unit test file (a jest-dom matcher registration, for example). */
  readonly setupFiles?: readonly string[]
  /** Run once, in Node, before the unit tests (the Paraglide fixture compile). */
  readonly globalSetup?: readonly string[]
  /** Load real CSS in unit tests, so a component test sees its styles. */
  readonly css?: boolean
  /** Compile Svelte (components, and runes in `*.svelte.test.ts`) and resolve Svelte's client build. */
  readonly svelte?: boolean
  /** More plugins (the content plugin of a game, Testing Library's Svelte plugin). */
  readonly plugins?: readonly PluginOption[]
  /** Package export conditions to resolve before the defaults (`automata-ruken` picks the Ruken adapter). */
  readonly conditions?: readonly string[]
  /** The engines `tests/browser` runs in. All three by default; `[]` for a package with no browser tests. */
  readonly browsers?: readonly Engine[]
  /**
   * Named browser projects, one per folder of `tests/browser/`, in place of the one `browser` project (and `browsers`).
   * `[]` for a package with no browser tests.
   */
  readonly browserProjects?: readonly BrowserProject[]
  /** Commands a browser test can call (the golden file reader). */
  readonly browserCommands?: Readonly<Record<string, BrowserCommand<never[]>>>
  /** Dependencies Vite pre-bundles up front: on a cold cache it otherwise reloads test pages mid-run. */
  readonly optimizeDeps?: readonly string[]
  /** Unit tests that need longer than Vitest's 5 s (the golden harness re-records 300 ticks). */
  readonly testTimeout?: number
  /** Modules Vite transforms instead of loading as-is from node_modules (a generated fixture package). */
  readonly inline?: readonly RegExp[]
  /**
   * Browser tests that also run in Node, as globs from the package root. A golden or parity test is checked in all
   * four engines (AGENTS.md, determinism), and Node is the fourth.
   */
  readonly alsoInNode?: readonly string[]
}

const ALL_ENGINES: readonly Engine[] = BROWSER_ENGINES

export function defineTests(options: TestOptions = {}): ViteUserConfig {
  const engines = options.browsers ?? ALL_ENGINES
  // Svelte's client build, so `mount` works in jsdom and in the browser (the default resolves its server entry).
  const conditions = [...(options.conditions ?? []), ...(options.svelte ? ['browser'] : [])]
  const plugins = [...(options.svelte ? [svelte()] : []), ...(options.plugins ?? [])]

  const unit = {
    extends: true,
    test: {
      name: 'unit',
      environment: options.environment ?? 'node',
      include: ['tests/unit/**/*.test.ts', ...(options.alsoInNode ?? [])],
      ...(options.setupFiles ? { setupFiles: [...options.setupFiles] } : {}),
      ...(options.globalSetup ? { globalSetup: [...options.globalSetup] } : {}),
      ...(options.css === undefined ? {} : { css: options.css }),
      ...(options.testTimeout === undefined ? {} : { testTimeout: options.testTimeout }),
      ...(options.inline ? { server: { deps: { inline: [...options.inline] } } } : {}),
    },
  }

  // Every browser project shares the commands, the timeout and the headless Playwright provider; they differ in the files
  // they take and the instances they run.
  const browserProject = (name: string, include: string, instances: readonly BrowserInstance[]) => ({
    extends: true,
    test: {
      name,
      include: [include],
      // A browser test can take as long as the golden harness does in Node.
      ...(options.testTimeout === undefined ? {} : { testTimeout: options.testTimeout }),
      browser: {
        enabled: true,
        headless: true,
        provider: playwright(),
        ...(options.browserCommands ? { commands: options.browserCommands } : {}),
        instances: [...instances],
      },
    },
  })
  const named = options.browserProjects
  if (named) {
    const names = named.map((project) => project.name)
    const repeated = names.find((name, at) => names.indexOf(name) !== at)
    if (repeated !== undefined) throw new Error(`defineTests: two browser projects are named "${repeated}"`)
  }
  const browserProjects = named
    ? named.map((project) =>
        browserProject(
          project.name,
          `tests/browser/${project.folder}/**/*.test.ts`,
          project.engines.flatMap((engine) => project.instance?.(engine) ?? { browser: engine }),
        ),
      )
    : engines.length > 0
      ? [
          browserProject(
            'browser',
            'tests/browser/**/*.test.ts',
            engines.map((browser) => ({ browser })),
          ),
        ]
      : []

  // Timings measure the machine as much as the code, so they stay out of every gate; root `pnpm bench` sets AF_BENCH.
  const bench = {
    extends: true,
    test: { name: 'bench', environment: 'node', include: ['tests/bench/**/*.test.ts'] },
  }

  return {
    ...(plugins.length > 0 ? { plugins } : {}),
    ...(conditions.length > 0 ? { resolve: { conditions } } : {}),
    ...(options.optimizeDeps ? { optimizeDeps: { include: [...options.optimizeDeps] } } : {}),
    test: {
      projects: [unit, ...browserProjects, ...(process.env.AF_BENCH ? [bench] : [])],
    },
  } as ViteUserConfig
}

// The settings every AF Playwright config shares. Each game or example set has its own config, which starts
// only its own servers, so a run for one area never waits on another area's builds.
import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test'

/**
 * The sizes every 2D journey runs at: a phone, the compact landscape height every layout must hold
 * (780 × 270, AGENTS.md), and an iPad, the Owner's test device.
 */
export const sizes = {
  phone: devices['iPhone 15'],
  compact: { ...devices['Pixel 7 landscape'], viewport: { width: 780, height: 270 } },
  ipad: devices['iPad Pro 11'],
} as const

type Env = Readonly<Record<string, string | undefined>>

/**
 * How many workers the journeys start. Playwright's default is half the cores, which on the Owner's Mac (three CI
 * runners on one M1) is about four browsers per job, and three jobs at once left every failure a 30 s timeout
 * (hub, 2026-10-23). So CI gets two workers, a developer keeps Playwright's default (`undefined`), and
 * `AF_E2E_WORKERS` overrides both. A value that is not a positive integer throws: `Number('two')` would reach
 * Playwright as `NaN`.
 */
export function e2eWorkers(env: Env): number | undefined {
  const requested = env.AF_E2E_WORKERS
  if (requested === undefined || requested === '') return env.CI ? 2 : undefined
  const workers = Number(requested)
  if (!Number.isInteger(workers) || workers < 1)
    throw new Error(`AF_E2E_WORKERS must be a positive integer, got "${requested}"`)
  return workers
}

/**
 * A journey config: the shared settings below, then whatever `config` sets (a game's projects and servers).
 * `env` is a parameter so a test can pass its own; a config file leaves it out and gets `process.env`.
 */
export function defineJourneys(config: PlaywrightTestConfig, env: Env = process.env): PlaywrightTestConfig {
  const workers = e2eWorkers(env)
  return defineConfig({
    // Journeys end in `.e2e.ts` in an area that has not moved yet and are `*.test.ts` under `tests/e2e/` in one that has
    // (core and 2D refactor, task 3.3). Playwright fails a run that matches nothing. When the last area has moved this
    // is `**/*.test.ts` alone.
    testMatch: ['**/*.e2e.ts', '**/*.test.ts'],
    forbidOnly: env.CI !== undefined,
    fullyParallel: true,
    retries: env.CI ? 1 : 0,
    reporter: env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
    use: { trace: 'retain-on-failure' },
    ...(workers === undefined ? {} : { workers }),
    ...config,
  })
}

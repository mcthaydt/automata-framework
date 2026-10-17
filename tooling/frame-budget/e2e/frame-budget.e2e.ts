// The frame-budget probe (PRODUCT spec §2 F5): ms/frame of the core stress example's production build, written as
// one JSON result per project for `pnpm budget:frame`. Runs only under `AF_FRAME_BUDGET=1` (`pnpm
// test:frame-budget`), alone, on the GPU runner. It asserts that the page ran cleanly and that frames were
// measured; the budget itself is compared by the check, so the first GPU-runner run records numbers even while
// no budget exists.
//
// Method, after spike S8 (examples/placeholder/s8/measure.ts) and FloorFifty's probes (ac72660,
// tests/e2e/frame-budget.spec.ts and tests/e2e/support/perf-probe.ts):
// - the built page, served with Ruken's headers; a CSP violation, page error or console error fails the run;
// - every requestAnimationFrame callback is timed from an init script, with no hook in the game. A frame's
//   work is the sum of its callbacks (sim steps, entity views, Pixi's draw submission, the UI). Its interval
//   is the time between frames, which stops at vsync but also shows a GPU that cannot keep up;
// - warm up, then sample for a fixed window, both counted in the page's own frames rather than with sleeps.
// The wrapper itself costs a little per frame, the same in every run, so runs stay comparable.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { cpus, release, type } from 'node:os'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { FrameBudgetResult } from '../src/budget.ts'
import { resultsDir, stressUrl } from '../src/origin.ts'
import { summarize } from '../src/stats.ts'

const setting = (name: string, fallback: number): number => Number(process.env[name] ?? fallback)
const ENTITIES = setting('AF_FRAME_BUDGET_ENTITIES', 2000)
const SYSTEMS = setting('AF_FRAME_BUDGET_SYSTEMS', 8)
const WARMUP_MS = setting('AF_FRAME_BUDGET_WARMUP_MS', 2000)
const SAMPLE_MS = setting('AF_FRAME_BUDGET_SAMPLE_MS', 10_000)

interface ProbeWindow {
  __afFrameProbe: {
    start(): void
    stop(): { work: number[]; stamps: number[] }
    violations: string[]
  }
}

/** Runs in the page before any of its scripts. Self-contained: Playwright serializes it. */
function installProbe(): void {
  const native = window.requestAnimationFrame.bind(window)
  const work: number[] = []
  const stamps: number[] = []
  const violations: string[] = []
  let recording = false
  let frameStamp = -1
  let frameWork = 0
  const closeFrame = (): void => {
    if (frameStamp < 0) return
    work.push(frameWork)
    stamps.push(frameStamp)
  }
  // Callbacks that share a rAF timestamp belong to one frame, so their times add up.
  window.requestAnimationFrame = (callback) =>
    native((timestamp) => {
      const started = performance.now()
      try {
        callback(timestamp)
      } finally {
        if (recording) {
          if (timestamp !== frameStamp) {
            closeFrame()
            frameStamp = timestamp
            frameWork = 0
          }
          frameWork += performance.now() - started
        }
      }
    })
  document.addEventListener('securitypolicyviolation', (event) => violations.push(event.violatedDirective))
  ;(window as unknown as ProbeWindow).__afFrameProbe = {
    violations,
    start() {
      work.length = 0
      stamps.length = 0
      frameStamp = -1
      recording = true
    },
    stop() {
      recording = false
      closeFrame()
      return { work: [...work], stamps: [...stamps] }
    },
  }
}

/** Resolves once `ms` of the page's own frames have gone by. */
const framesFor = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    const until = performance.now() + ms
    const next = (): void => {
      if (performance.now() >= until) resolve()
      else requestAnimationFrame(next)
    }
    requestAnimationFrame(next)
  })

/** What JSON keeps of a value (NaN becomes null), so the schema checks exactly what is written. */
const asJson = (value: unknown): unknown => JSON.parse(JSON.stringify(value))

function commit(): string {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    return process.env.GITHUB_SHA ?? 'unknown'
  }
}

test('frame budget: the core stress example, ms per frame', async ({ page, browser }, testInfo) => {
  test.setTimeout(WARMUP_MS + SAMPLE_MS + 120_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  await page.addInitScript(installProbe)

  await page.goto(`${stressUrl}?entities=${ENTITIES}&systems=${SYSTEMS}`)
  await expect(page.locator('html')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
  const hud = page.getByTestId('stress-hud')
  await expect(hud).toHaveAttribute('data-stress-entities', String(ENTITIES))
  // The first Beat (tick 30) proves the loop is stepping the sim before anything is timed.
  await expect(hud).toHaveAttribute('data-stress-ticks', /^[1-9]\d*$/, { timeout: 60_000 })

  await page.evaluate(framesFor, WARMUP_MS)
  await page.evaluate(() => (window as unknown as ProbeWindow).__afFrameProbe.start())
  await page.evaluate(framesFor, SAMPLE_MS)
  const { work, stamps } = await page.evaluate(() => (window as unknown as ProbeWindow).__afFrameProbe.stop())
  const violations = await page.evaluate(() => (window as unknown as ProbeWindow).__afFrameProbe.violations)

  const pageFacts = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('canvas.af-stage')
    const gl = document.createElement('canvas').getContext('webgl2')
    const info = gl?.getExtension('WEBGL_debug_renderer_info')
    return {
      renderer: canvas?.dataset.renderer ?? 'missing',
      gpu: gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'unknown',
      gpuVendor: gl && info ? String(gl.getParameter(info.UNMASKED_VENDOR_WEBGL)) : 'unknown',
      userAgent: navigator.userAgent,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      devicePixelRatio: window.devicePixelRatio,
    }
  })

  const intervals = stamps.slice(1).map((stamp, index) => stamp - (stamps[index] as number))
  const result = FrameBudgetResult.parse({
    schema: 'af-frame-budget-result/1',
    project: testInfo.project.name,
    measuredAt: new Date().toISOString(),
    scene: { entities: ENTITIES, systems: SYSTEMS },
    sample: { warmupMs: WARMUP_MS, sampleMs: SAMPLE_MS },
    environment: {
      gpu: pageFacts.gpu,
      gpuVendor: pageFacts.gpuVendor,
      renderer: pageFacts.renderer,
      browser: browser.browserType().name(),
      browserVersion: browser.version(),
      userAgent: pageFacts.userAgent,
      viewport: pageFacts.viewport,
      devicePixelRatio: pageFacts.devicePixelRatio,
      os: `${type()} ${release()}`,
      cpus: cpus().length,
      cpuModel: cpus()[0]?.model ?? 'unknown',
      node: process.version,
      commit: commit(),
      runner: process.env.RUNNER_NAME ?? null,
      // GitHub Actions, not `CI`: local runs set CI=1 to stop Playwright reusing another checkout's server.
      ci: process.env.GITHUB_ACTIONS === 'true',
    },
    // JSON has no NaN; an empty sample is written as null, which the check counts as not measured.
    workMs: asJson(summarize(work)),
    intervalMs: asJson(summarize(intervals)),
  })

  mkdirSync(resultsDir, { recursive: true })
  const path = join(resultsDir, `${result.project}.json`)
  writeFileSync(path, `${JSON.stringify(result, null, 2)}\n`)
  await testInfo.attach('frame-budget-result', { path, contentType: 'application/json' })
  console.log(
    `${result.project}: ${result.workMs.count} frames on ${result.environment.gpu}; ` +
      `work p50 ${result.workMs.p50?.toFixed(2)} / p95 ${result.workMs.p95?.toFixed(2)} ms, ` +
      `interval p50 ${result.intervalMs.p50?.toFixed(2)} / p95 ${result.intervalMs.p95?.toFixed(2)} ms`,
  )

  expect(violations, "the build broke Ruken's CSP").toEqual([])
  expect(errors).toEqual([])
  expect(work.length, 'no frames were measured').toBeGreaterThan(1)
})

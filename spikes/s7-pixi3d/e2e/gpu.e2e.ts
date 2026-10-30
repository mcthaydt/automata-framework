// Spike S7 part 2 (M3.1b): the GPU-runner questions. TEMPORARY: this file goes with spikes/s7-pixi3d and the `s7`
// project in the root playwright.config.ts when M3.1b records the verdict.
//
// Dispatched as a focused browser run (ci.yml `workflow_dispatch`, input `spec`, the e2e job on the GPU runner):
//   spec: "spikes/s7-pixi3d/e2e/gpu.e2e.ts --project=s7"
// Locally: `PLAYWRIGHT_BROWSERS_PATH=… pnpm exec playwright test spikes/s7-pixi3d/e2e/gpu.e2e.ts --project=s7`.
//
// It installs the spike (a standalone package outside the workspace), builds its pages, serves the build with
// Ruken's headers (`compileHeaders`, serve.ts) and records, from the page with the AF-owned no-eval shim (the
// Owner's S7-Q1 decision, 2026-10-30):
// - S7-Q1: boots in Chromium, WebKit and Firefox with zero CSP violations and zero console errors;
// - S7-Q2: WebGL2 against WebGPU captures of one held frame, within M3-D5 (per channel ≤ 2 on 99.5% of pixels, no
//   pixel above 16);
// - S7-Q4: a capture through pixi's `renderer.extract` is non-black (mean luminance ≥ 16 of 255) on both;
// - S7-Q3: p95 frame time over 20 s after a 3 s warm-up on both phone profiles (M3-D6) with PRODUCT.7's probe
//   (tooling/frame-budget); a software renderer is rejected and no number is reported for it;
// - S7-Q8, S7-Q9: the rig and figure timings in the browser on the phone profiles (bench.html);
// - S7-Q10: the figure's height in the frame at 16:9, 4:3, 21:9, 844×390 and 780×270, the void above the horizon,
//   the depth-precision pair and the 21:9 edge stretch, with captures.
//
// Every test records into one results object and never fails on a criterion, so one miss cannot cost the others
// their numbers: the verdicts are in `s7-results.json`. The e2e job uploads `**/playwright-report/` only when it
// fails (ci.yml is not edited for a spike, coordinator's ruling 2026-10-30), so under GitHub Actions the last test
// fails on purpose, after attaching the results, to have the report (results and captures) uploaded.
import { execFileSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import type { Server } from 'node:http'
import { createRequire } from 'node:module'
import { cpus, type as osType, release } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  type Browser,
  type BrowserContextOptions,
  type BrowserType,
  chromium,
  firefox,
  type Page,
  type TestInfo,
  test,
  webkit,
} from '@playwright/test'
import { isSoftwareGpu } from '../../../tooling/frame-budget/src/budget.ts'
import { summarize } from '../../../tooling/frame-budget/src/stats.ts'

const SPIKE = join(import.meta.dirname, '..')
const OUT = join(SPIKE, 'out', 'gpu')
const PAGE = 'index-shim.html'
const STILL = 2 // seconds into the clips: the held frame for S7-Q2, Q4 and Q10
const WARMUP_MS = 3000
const SAMPLE_MS = 20_000
const P95_LIMIT_MS = 33.3
const NON_BLACK_LUMA = 16
const TOLERANCE = { channel: 2, share: 0.005, max: 16 } // M3-D5
const KEY = { r: 0, g: 255, b: 0 } // scene-page.ts KEY_COLOR

// The phone profiles (M3-D6): Galaxy S20 (360×800, DPR 3) and iPhone 13 (390×844, DPR 3) in Chromium at 4× CPU
// throttling, and WebKit at the iPhone size unthrottled. The runtime is landscape-only, so they are measured
// landscape. Playwright has no Galaxy S20 descriptor; these are the spec's sizes.
interface Profile {
  readonly name: string
  readonly engine: 'chromium' | 'webkit'
  readonly context: BrowserContextOptions
  readonly cpuThrottle: number
}
const phone = (width: number, height: number, mobile: boolean): BrowserContextOptions => ({
  viewport: { width, height },
  deviceScaleFactor: 3,
  hasTouch: true,
  isMobile: mobile,
})
const PROFILES: readonly Profile[] = [
  { name: 'galaxy-s20-chromium-4x', engine: 'chromium', context: phone(800, 360, true), cpuThrottle: 4 },
  { name: 'iphone-13-chromium-4x', engine: 'chromium', context: phone(844, 390, true), cpuThrottle: 4 },
  { name: 'iphone-13-webkit', engine: 'webkit', context: phone(844, 390, true), cpuThrottle: 1 },
]

// S7-Q10's sizes: three aspect ratios at desktop size, then the landscape phone and the compact height.
const SIZES = [
  { name: '16x9', width: 1280, height: 720 },
  { name: '4x3', width: 1024, height: 768 },
  { name: '21x9', width: 1680, height: 720 },
  { name: 'phone-844x390', width: 844, height: 390 },
  { name: 'compact-780x270', width: 780, height: 270 },
] as const

// --- shared state ---------------------------------------------------------------------------------------------

type Png = { width: number; height: number; data: Buffer }
type PngModule = {
  PNG: { sync: { read(buffer: Buffer): Png; write(png: Png): Buffer }; new (o: object): Png }
}

let server: Server | undefined
let origin = ''
let png: PngModule
const results: Record<string, unknown> = {
  schema: 's7-gpu-results/1',
  measuredAt: new Date().toISOString(),
  page: PAGE,
  environment: {
    commit: commit(),
    runner: process.env.RUNNER_NAME ?? null,
    githubActions: process.env.GITHUB_ACTIONS === 'true',
    os: `${osType()} ${release()}`,
    platform: process.platform,
    cpus: cpus().length,
    cpuModel: cpus()[0]?.model ?? 'unknown',
    node: process.version,
  },
  browsers: {} as Record<string, string>,
}

function commit(): string {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    return process.env.GITHUB_SHA ?? 'unknown'
  }
}

/** Runs one question's body; an error is recorded as that question's result instead of failing the run. */
async function record(testInfo: TestInfo, key: string, body: () => Promise<unknown>): Promise<void> {
  let value: unknown
  try {
    value = await body()
  } catch (error) {
    value = { error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) }
  }
  results[key] = value
  await testInfo.attach(`${key}.json`, {
    body: JSON.stringify(value, null, 2),
    contentType: 'application/json',
  })
}

async function saveImage(testInfo: TestInfo, name: string, bytes: Buffer): Promise<string> {
  const path = testInfo.outputPath(name)
  writeFileSync(path, bytes)
  await testInfo.attach(name, { path, contentType: 'image/png' })
  return name
}

// --- browsers and pages ---------------------------------------------------------------------------------------

const ENGINES: Record<string, BrowserType> = { chromium, webkit, firefox }

/**
 * Chromium launches as full Chromium (`channel: 'chromium'`, new headless), which keeps the GPU; Playwright's
 * default headless shell rasterizes WebGL in SwiftShader (tooling/frame-budget/src/playwright-run.ts). Where full
 * Chromium is not installed (this container), it falls back to the shell and says so; the GPU string then names
 * SwiftShader and every GPU number is rejected.
 */
async function launch(engine: string): Promise<{ browser: Browser; note: string }> {
  const type = ENGINES[engine]!
  if (engine === 'chromium') {
    const args = ['--enable-unsafe-webgpu']
    try {
      return {
        browser: await type.launch({ channel: 'chromium', args }),
        note: 'full Chromium (new headless)',
      }
    } catch {
      return { browser: await type.launch({ args }), note: 'headless shell: full Chromium is not installed' }
    }
  }
  return { browser: await type.launch(), note: '' }
}

async function withBrowser<T>(engine: string, body: (browser: Browser, note: string) => Promise<T>) {
  const { browser, note } = await launch(engine)
  ;(results.browsers as Record<string, string>)[engine] = `${browser.version()}${note ? ` (${note})` : ''}`
  try {
    return await body(browser, note)
  } finally {
    await browser.close()
  }
}

interface Opened {
  readonly page: Page
  readonly ready: boolean
  readonly report: Record<string, unknown> | null
  readonly violations: () => Promise<string[]>
  readonly errors: string[]
  close(): Promise<void>
}

interface S7Window {
  __s7?: { ready: boolean }
  __s7csp: string[]
}

/** Opens a spike page; waits for the page's own readiness (30 frames drawn and the prop loaded). */
async function open(
  browser: Browser,
  path: string,
  context: BrowserContextOptions,
  options: { cpuThrottle?: number; probe?: boolean } = {},
): Promise<Opened> {
  const ctx = await browser.newContext(context)
  const page = await ctx.newPage()
  if ((options.cpuThrottle ?? 1) > 1) {
    const cdp = await ctx.newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: options.cpuThrottle })
  }
  await page.addInitScript(() => {
    const seen: string[] = []
    ;(window as unknown as S7Window).__s7csp = seen
    document.addEventListener('securitypolicyviolation', (event) =>
      seen.push(`${event.violatedDirective} ${event.blockedURI}`),
    )
  })
  if (options.probe) await page.addInitScript(installProbe)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  await page.goto(`${origin}/${path}`)
  let ready = true
  await page
    .waitForFunction(() => (window as unknown as S7Window).__s7?.ready === true, null, { timeout: 60_000 })
    .catch(() => {
      ready = false
    })
  const report = (await page.evaluate(
    () => (window as unknown as { __s7?: unknown }).__s7 ?? null,
  )) as Record<string, unknown> | null
  return {
    page,
    ready,
    report,
    errors,
    violations: () => page.evaluate(() => [...(window as unknown as S7Window).__s7csp]),
    close: () => ctx.close(),
  }
}

/**
 * A software renderer draws in the CPU and its numbers are never GPU evidence; nor is a page with no GPU renderer
 * at all (the page reports `none (canvas renderer)`). WebKit masks its renderer string ("Apple GPU") everywhere,
 * so WebKit counts as a GPU only on macOS, where it has one.
 */
function softwareGpu(engine: string, gpu: string): boolean {
  return (
    isSoftwareGpu(gpu) || gpu.startsWith('none') || (engine === 'webkit' && process.platform !== 'darwin')
  )
}

// --- images ---------------------------------------------------------------------------------------------------

/** Per-channel difference of two same-size images, against M3-D5, with a diff image (red where above 2). */
function compare(a: Png, b: Png) {
  if (a.width !== b.width || a.height !== b.height)
    return { comparable: false, sizes: [`${a.width}×${a.height}`, `${b.width}×${b.height}`] }
  const diff = new png.PNG({ width: a.width, height: a.height })
  let over = 0
  let max = 0
  for (let i = 0; i < a.data.length; i += 4) {
    let pixelMax = 0
    for (let c = 0; c < 3; c++) pixelMax = Math.max(pixelMax, Math.abs(a.data[i + c]! - b.data[i + c]!))
    max = Math.max(max, pixelMax)
    if (pixelMax > TOLERANCE.channel) over++
    const hot = pixelMax > TOLERANCE.channel
    diff.data[i] = hot ? 255 : a.data[i]! >> 2
    diff.data[i + 1] = hot ? 0 : a.data[i + 1]! >> 2
    diff.data[i + 2] = hot ? 0 : a.data[i + 2]! >> 2
    diff.data[i + 3] = 255
  }
  const pixels = a.width * a.height
  const share = over / pixels
  return {
    comparable: true,
    pixels,
    overChannelTolerance: over,
    shareOver: share,
    maxChannelDiff: max,
    pass: share <= TOLERANCE.share && max <= TOLERANCE.max,
    diffPng: png.PNG.sync.write(diff),
  }
}

const isKey = (data: Buffer, i: number) =>
  Math.abs(data[i]! - KEY.r) + Math.abs(data[i + 1]! - KEY.g) + Math.abs(data[i + 2]! - KEY.b) <= 24

/** The bounding box of the pixels that are not the key colour. */
function boundsNotKey(image: Png) {
  let top = image.height
  let bottom = -1
  let left = image.width
  let right = -1
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (isKey(image.data, (y * image.width + x) * 4)) continue
      top = Math.min(top, y)
      bottom = Math.max(bottom, y)
      left = Math.min(left, x)
      right = Math.max(right, x)
    }
  }
  return bottom < 0 ? null : { top, bottom, left, right, height: bottom - top + 1, width: right - left + 1 }
}

/** The share of key-colour pixels (the void: nothing drawn), overall and in the top tenth of the frame. */
function voidShare(image: Png) {
  let all = 0
  let top = 0
  const band = Math.ceil(image.height / 10)
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (!isKey(image.data, (y * image.width + x) * 4)) continue
      all++
      if (y < band) top++
    }
  }
  return { share: all / (image.width * image.height), topTenthShare: top / (band * image.width) }
}

// --- PRODUCT.7's probe ----------------------------------------------------------------------------------------

interface ProbeWindow {
  __afFrameProbe: { start(): void; stop(): { work: number[]; stamps: number[] } }
}

/**
 * PRODUCT.7's frame probe, copied from tooling/frame-budget/e2e/frame-budget.e2e.ts (`installProbe`, not exported,
 * and importing that spec would register its test here), without its CSP list, which `open` keeps. Every
 * requestAnimationFrame callback is timed; a frame's work is the sum of its callbacks, its interval the time
 * between frames. Self-contained: Playwright serializes it.
 */
function installProbe(): void {
  const native = window.requestAnimationFrame.bind(window)
  const work: number[] = []
  const stamps: number[] = []
  let recording = false
  let frameStamp = -1
  let frameWork = 0
  const closeFrame = (): void => {
    if (frameStamp < 0) return
    work.push(frameWork)
    stamps.push(frameStamp)
  }
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
  ;(window as unknown as ProbeWindow).__afFrameProbe = {
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

/** Resolves once `ms` of the page's own frames have gone by (PRODUCT.7's `framesFor`). */
const framesFor = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    const until = performance.now() + ms
    const next = (): void => {
      if (performance.now() >= until) resolve()
      else requestAnimationFrame(next)
    }
    requestAnimationFrame(next)
  })

// --- the run --------------------------------------------------------------------------------------------------

test.beforeAll(async () => {
  test.setTimeout(600_000)
  // The spike is not in the workspace: install it on its own lockfile when this checkout has not.
  if (!existsSync(join(SPIKE, 'node_modules', '.modules.yaml'))) {
    execFileSync('pnpm', ['install', '--ignore-workspace', '--frozen-lockfile'], {
      cwd: SPIKE,
      stdio: 'inherit',
    })
  }
  png = createRequire(join(SPIKE, 'package.json'))('pngjs') as PngModule
  // Always a fresh build of this checkout, never a previous run's.
  const { serve, viteBuild } = (await import(
    pathToFileURL(join(SPIKE, 'serve.ts')).href
  )) as typeof import('../serve.ts')
  const served = await serve(viteBuild(OUT, 'gpu'))
  server = served.server
  origin = served.origin
  results.csp = served.csp
})

test.afterAll(() => {
  server?.close()
})

test('S7-Q1: the scene with the shim under the CSP in Chromium, WebKit and Firefox', async () => {
  const testInfo = test.info()
  test.setTimeout(300_000)
  await record(testInfo, 'q1', async () => {
    const rows: Record<string, unknown> = {}
    for (const engine of ['chromium', 'webkit', 'firefox']) {
      rows[engine] = await withBrowser(engine, async (browser) => {
        const opened = await open(browser, PAGE, { viewport: { width: 1280, height: 720 } })
        const report = opened.report ?? {}
        const violations = await opened.violations()
        const capture = await saveImage(testInfo, `q1-${engine}.png`, await opened.page.screenshot())
        await opened.close()
        const renderer = String(report.renderer ?? '')
        const gpu = String(report.gpu ?? '')
        return {
          ready: opened.ready,
          renderer,
          gpu,
          software: softwareGpu(engine, gpu),
          violations,
          consoleErrors: opened.errors,
          pageErrors: report.errors ?? [],
          capture,
          // A Canvas-renderer fallback draws no 3D (part 1, Firefox without WebGL): not a pass.
          pass:
            opened.ready &&
            violations.length === 0 &&
            opened.errors.length === 0 &&
            (renderer === 'webgl' || renderer === 'webgpu'),
        }
      })
    }
    return rows
  })
})

test('S7-Q2 and S7-Q4: WebGL2 and WebGPU captures of one held frame', async () => {
  const testInfo = test.info()
  test.setTimeout(300_000)
  await record(testInfo, 'q2q4', async () => {
    const rows: Record<string, unknown> = {}
    for (const engine of ['chromium', 'webkit', 'firefox']) {
      rows[engine] = await withBrowser(engine, async (browser) => {
        const shots: Record<string, Png> = {}
        const backends: Record<string, unknown> = {}
        for (const backend of ['webgl', 'webgpu'] as const) {
          const opened = await open(browser, `${PAGE}?still=${STILL}&renderer=${backend}`, {
            viewport: { width: 1280, height: 720 },
          })
          const report = opened.report ?? {}
          const renderer = String(report.renderer ?? '')
          const screenshot = await opened.page.screenshot()
          const capture = await saveImage(testInfo, `q2-${engine}-${backend}.png`, screenshot)
          // S7-Q4: pixi's own extract of the stage, which is what a game's capture path would use.
          const extract = (await opened.page
            .evaluate(() =>
              (window as unknown as { __s7extract: () => Promise<Record<string, unknown>> }).__s7extract(),
            )
            .catch((error: unknown) => ({ error: String(error) }))) as Record<string, unknown>
          let extractCapture: string | undefined
          if (typeof extract.png === 'string') {
            const bytes = Buffer.from(extract.png.replace(/^data:image\/png;base64,/, ''), 'base64')
            extractCapture = await saveImage(testInfo, `q4-${engine}-${backend}-extract.png`, bytes)
          }
          const violations = await opened.violations()
          await opened.close()
          // A WebGPU request that fell back to WebGL2 is not a WebGPU capture.
          const ranAsAsked = renderer === backend
          if (opened.ready && ranAsAsked) shots[backend] = png.PNG.sync.read(screenshot)
          const meanLuma = typeof extract.meanLuma === 'number' ? extract.meanLuma : null
          backends[backend] = {
            ready: opened.ready,
            renderer,
            ranAsAsked,
            gpu: String(report.gpu ?? ''),
            software: softwareGpu(engine, String(report.gpu ?? '')),
            violations,
            consoleErrors: opened.errors,
            capture,
            extract: {
              width: extract.width ?? null,
              height: extract.height ?? null,
              meanLuma,
              opaqueShare: extract.opaqueShare ?? null,
              error: extract.error ?? null,
              capture: extractCapture ?? null,
            },
            q4NonBlack: ranAsAsked && meanLuma !== null && meanLuma >= NON_BLACK_LUMA,
          }
        }
        let q2: Record<string, unknown> = { compared: false, reason: 'both backends did not run as asked' }
        if (shots.webgl && shots.webgpu) {
          const { diffPng, ...numbers } = compare(shots.webgl, shots.webgpu)
          q2 = { compared: true, ...numbers }
          if (diffPng) q2.diff = await saveImage(testInfo, `q2-${engine}-diff.png`, diffPng)
        }
        return { backends, q2 }
      })
    }
    return { tolerance: TOLERANCE, nonBlackLuma: NON_BLACK_LUMA, still: STILL, engines: rows }
  })
})

test('S7-Q3: p95 frame time on the phone profiles with PRODUCT.7 probe', async () => {
  const testInfo = test.info()
  test.setTimeout(600_000)
  await record(testInfo, 'q3', async () => {
    const rows: Record<string, unknown> = {}
    for (const profile of PROFILES) {
      rows[profile.name] = await withBrowser(profile.engine, async (browser) => {
        const opened = await open(browser, PAGE, profile.context, {
          cpuThrottle: profile.cpuThrottle,
          probe: true,
        })
        try {
          const report = opened.report ?? {}
          const gpu = String(report.gpu ?? '')
          const base = {
            viewport: profile.context.viewport,
            deviceScaleFactor: profile.context.deviceScaleFactor,
            cpuThrottle: profile.cpuThrottle,
            renderer: String(report.renderer ?? ''),
            resolution: report.resolution ?? null,
            gpu,
          }
          if (!opened.ready) return { ...base, verdict: 'not-ready', errors: opened.errors }
          // PRODUCT.7's rule: a software renderer's frame time is never a budget number, so none is reported.
          if (softwareGpu(profile.engine, gpu))
            return { ...base, verdict: 'rejected', reason: `software renderer (${gpu || 'unknown'})` }
          await opened.page.evaluate(framesFor, WARMUP_MS)
          await opened.page.evaluate(() => (window as unknown as ProbeWindow).__afFrameProbe.start())
          await opened.page.evaluate(framesFor, SAMPLE_MS)
          const { work, stamps } = await opened.page.evaluate(() =>
            (window as unknown as ProbeWindow).__afFrameProbe.stop(),
          )
          const intervals = stamps.slice(1).map((stamp, index) => stamp - stamps[index]!)
          const intervalMs = summarize(intervals)
          const violations = await opened.violations()
          return {
            ...base,
            warmupMs: WARMUP_MS,
            sampleMs: SAMPLE_MS,
            workMs: summarize(work),
            intervalMs,
            violations,
            consoleErrors: opened.errors,
            // The frame time is the interval between frames (it includes the GPU); work is the CPU share.
            verdict:
              intervalMs.p95 <= P95_LIMIT_MS && violations.length === 0 && opened.errors.length === 0
                ? 'pass'
                : 'miss',
          }
        } finally {
          await opened.close()
        }
      })
    }
    return { limitMs: P95_LIMIT_MS, profiles: rows }
  })
})

test('S7-Q8 and S7-Q9: rig and figure timings on the phone profiles', async () => {
  const testInfo = test.info()
  test.setTimeout(300_000)
  await record(testInfo, 'q8q9', async () => {
    const rows: Record<string, unknown> = {}
    for (const profile of PROFILES) {
      rows[profile.name] = await withBrowser(profile.engine, async (browser) => {
        const ctx = await browser.newContext(profile.context)
        const page = await ctx.newPage()
        if (profile.cpuThrottle > 1) {
          const cdp = await ctx.newCDPSession(page)
          await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpuThrottle })
        }
        try {
          await page.goto(`${origin}/bench.html`)
          await page.waitForFunction(
            () => (window as unknown as { __s7bench?: { done: boolean } }).__s7bench?.done === true,
            null,
            { timeout: 240_000 },
          )
          const bench = (await page.evaluate(
            () => (window as unknown as { __s7bench: unknown }).__s7bench,
          )) as {
            result?: {
              oneSolve: { mean: number }
              perFrame: { mean: number }
              jointsAndMeshes: { mean: number }
              build: { mean: number }
            }
            error?: string
          }
          const r = bench.result
          return {
            cpuThrottle: profile.cpuThrottle,
            ...bench,
            // Targets (M3 spec §3): ≤ 0.1 ms a solve, ≤ 0.3 ms a figure's frame, ≤ 20 ms a build.
            targets: r
              ? {
                  solveUnder01ms: r.oneSolve.mean <= 0.1,
                  figureFrameUnder03ms: r.jointsAndMeshes.mean <= 0.3,
                  buildUnder20ms: r.build.mean <= 20,
                }
              : null,
          }
        } finally {
          await ctx.close()
        }
      })
    }
    return rows
  })
})

test('S7-Q10: the angled view on phones: figure height, void, depth and the 21:9 stretch', async () => {
  const testInfo = test.info()
  test.setTimeout(600_000)
  await record(testInfo, 'q10', async () =>
    withBrowser('chromium', async (browser) => {
      const shoot = async (path: string, viewport: { width: number; height: number }, name: string) => {
        const opened = await open(browser, path, { viewport })
        const bytes = await opened.page.screenshot()
        const gpu = String(opened.report?.gpu ?? '')
        const ready = opened.ready
        await opened.close()
        await saveImage(testInfo, name, bytes)
        return { image: png.PNG.sync.read(bytes), gpu, ready, capture: name }
      }
      const sizes: Record<string, unknown> = {}
      let gpu = ''
      for (const size of SIZES) {
        const viewport = { width: size.width, height: size.height }
        // The scene as the player sees it, then the followed 1.62 m figure alone on the key colour, then the
        // scene on the key colour, where any key pixel left is void the room and fog do not close.
        const scene = await shoot(`${PAGE}?still=${STILL}`, viewport, `q10-${size.name}-scene.png`)
        gpu = scene.gpu
        const solo = await shoot(
          `${PAGE}?still=${STILL}&solo=4&key=1`,
          viewport,
          `q10-${size.name}-figure.png`,
        )
        const keyed = await shoot(`${PAGE}?still=${STILL}&key=1`, viewport, `q10-${size.name}-void.png`)
        const box = boundsNotKey(solo.image)
        sizes[size.name] = {
          viewport,
          ready: scene.ready && solo.ready && keyed.ready,
          figure: box,
          figureHeightShare: box ? box.height / size.height : null,
          pass25: box ? box.height / size.height >= 0.25 : false,
          void: voidShare(keyed.image),
          captures: [scene.capture, solo.capture, keyed.capture],
        }
      }
      // Phone captures at the phones' density, for the Owner's look.
      for (const size of SIZES.slice(3)) {
        const opened = await open(browser, `${PAGE}?still=${STILL}`, {
          viewport: { width: size.width, height: size.height },
          deviceScaleFactor: 3,
        })
        await saveImage(testInfo, `q10-${size.name}-scene-dpr3.png`, await opened.page.screenshot())
        await opened.close()
      }
      // Depth precision: the projection's x and y do not depend on near and far, so the same frame at near 0.3,
      // far 120 and at near 1, far 30 differs only where depth precision decides which surface wins.
      const view = { width: 1280, height: 720 }
      const asShipped = await shoot(`${PAGE}?still=${STILL}`, view, 'q10-depth-near0.3-far120.png')
      const tight = await shoot(`${PAGE}?still=${STILL}&near=1&far=30`, view, 'q10-depth-near1-far30.png')
      const { diffPng, ...depth } = compare(asShipped.image, tight.image)
      const depthDiff = diffPng ? await saveImage(testInfo, 'q10-depth-diff.png', diffPng) : null
      // The 21:9 edge stretch: the figure alone at the middle and moved sideways to about 80% of the half-width
      // at its distance (5 m × aspect × tan(fov / 2) = 5 × 21/9 × 0.5), the camera's focus unchanged.
      const wide = { width: 1680, height: 720 }
      const edgeX = 0.8 * 5 * (wide.width / wide.height) * 0.5
      const middle = await shoot(`${PAGE}?still=${STILL}&solo=4&key=1`, wide, 'q10-stretch-middle.png')
      const edge = await shoot(
        `${PAGE}?still=${STILL}&solo=4&key=1&figureX=${edgeX}`,
        wide,
        'q10-stretch-edge.png',
      )
      const atMiddle = boundsNotKey(middle.image)
      const atEdge = boundsNotKey(edge.image)
      return {
        gpu,
        software: softwareGpu('chromium', gpu),
        expected: { figureHeightShare: 0.29, horizonInsideTopDeg: 26.565 - 25 },
        sizes,
        depth: { ...depth, diff: depthDiff },
        stretch21x9: {
          figureX: edgeX,
          middle: atMiddle,
          edge: atEdge,
          widthRatio: atMiddle && atEdge ? atEdge.width / atMiddle.width : null,
          heightRatio: atMiddle && atEdge ? atEdge.height / atMiddle.height : null,
        },
      }
    }),
  )
})

test('S7 results: s7-results.json', async () => {
  const testInfo = test.info()
  const json = `${JSON.stringify(results, null, 2)}\n`
  const path = testInfo.outputPath('s7-results.json')
  writeFileSync(path, json)
  await testInfo.attach('s7-results.json', { path, contentType: 'application/json' })
  console.log(`S7 results (${path}):\n${json}`)
  // The e2e job uploads the report only on failure (see the header): fail on purpose in CI, after attaching.
  if (process.env.GITHUB_ACTIONS === 'true')
    throw new Error(
      'S7 evidence run: failing on purpose so the e2e job uploads playwright-report (results and captures). ' +
        'The verdicts are in s7-results.json, not in this status.',
    )
})

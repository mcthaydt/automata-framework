// Measures one SPIKE_MODE: starts base-3d's Vite page with the look injected, plays to the room, holds the camera turn
// (KeyE) and walks (KeyD) for SECONDS, and prints the frame intervals. Software WebGL2 here: recorded, not judged.
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
const require = createRequire('/home/user/automata-framework/games/base-3d/package.json')
const { chromium } = require('playwright')

const mode = process.argv[2] ?? 'full'
const port = 5300 + ['full', 'lowres', 'passes', 'bake'].indexOf(mode)
const seconds = Number(process.env.SECONDS ?? 8)
const out = new URL('../out/', import.meta.url).pathname
mkdirSync(out, { recursive: true })

const server = spawn(
  'pnpm',
  [
    'exec',
    'vite',
    '--configLoader',
    'runner',
    '--config',
    '/home/user/automata-framework/spikes/3d-look/vite.config.ts',
    '--port',
    String(port),
    '--strictPort',
  ],
  {
    cwd: '/home/user/automata-framework/games/base-3d',
    env: { ...process.env, SPIKE_MODE: mode },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
)
let log = ''
server.stdout.on('data', (d) => (log += d))
server.stderr.on('data', (d) => (log += d))
const stop = () => server.kill('SIGTERM')
process.on('exit', stop)
for (let i = 0; i < 120 && !log.includes('Local:'); i++) await new Promise((r) => setTimeout(r, 500))

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 844, height: 390 } })
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto(`http://localhost:${port}/`)
await page.locator('body').press('KeyX')
await page
  .locator('[data-layer="screens"] [data-screen="title"]')
  .waitFor({ state: 'attached', timeout: 90000 })
await page.getByTestId('save-slots-new').click()
await page
  .locator('[data-layer="screens"] [data-screen="play"]')
  .waitFor({ state: 'attached', timeout: 90000 })
await page.waitForTimeout(3000)
await page.screenshot({ path: `${out}${mode}-still.png` })
await page.evaluate(() => {
  window.__dt = []
  let last = performance.now()
  const tick = (t) => {
    window.__dt.push(t - last)
    last = t
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
})
await page.keyboard.down('KeyE')
await page.keyboard.down('KeyD')
await page.waitForTimeout(seconds * 1000)
await page.keyboard.up('KeyE')
await page.keyboard.up('KeyD')
const dt = await page.evaluate(() => window.__dt.slice(2))
const spike = await page.evaluate(() => window.__spike ?? null)
await page.screenshot({ path: `${out}${mode}-turning.png` })
const sorted = [...dt].sort((a, b) => a - b)
const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]
const result = {
  mode,
  frames: dt.length,
  medianMs: +q(0.5).toFixed(1),
  p95Ms: +q(0.95).toFixed(1),
  meanMs: +(dt.reduce((a, b) => a + b, 0) / dt.length).toFixed(1),
  spike,
  errors: errors.slice(0, 5),
}
writeFileSync(`${out}${mode}.json`, JSON.stringify(result, null, 2))
console.log(JSON.stringify(result))
await browser.close()
stop()

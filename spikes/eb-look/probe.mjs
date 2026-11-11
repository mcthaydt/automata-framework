// Spike eb-look: probe. Draws one scene with each query variant given and prints the mean colour of fixed regions (wall,
// floor in the pool, ceiling) and writes a PNG per variant. `node probe.mjs <out dir> <scene> <view> "<query>" ...`
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { join } from 'node:path'
const repo = new URL('../..', import.meta.url).pathname
const { chromium } = createRequire(join(repo, 'packages/3d/package.json'))('playwright')
const [out, scene, view, ...variants] = process.argv.slice(2)
mkdirSync(out, { recursive: true })
// A free port the OS picks, so the repo names no port of its own.
const port = await new Promise((resolve) => {
  const s = createServer().listen(0, '127.0.0.1', () => {
    const { port: free } = s.address()
    s.close(() => resolve(free))
  })
})
const server = spawn('pnpm', ['exec', 'vite', '--config', join(repo, 'spikes/eb-look/vite.config.ts'), '--port', String(port), '--strictPort'], { cwd: join(repo, 'examples/3d'), stdio: ['ignore', 'pipe', 'pipe'], detached: true })
let log = ''
server.stdout.on('data', (d) => (log += d)); server.stderr.on('data', (d) => (log += d))
const stop = () => { try { process.kill(-server.pid, 'SIGTERM') } catch {} }
process.on('exit', stop)
for (let i = 0; i < 120 && !log.includes('Local:'); i++) await new Promise((r) => setTimeout(r, 500))
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const [w, h] = view === 'fp' ? [320, 200] : scene.startsWith('base-exterior') ? [640, 360] : [512, 320]
for (const [i, v] of variants.entries()) {
  const page = await browser.newPage({ viewport: { width: w * 2, height: h * 2 } })
  await page.goto(`http://localhost:${port}/?scene=${scene}&view=${view}&pref=webgl${v}`)
  await page.getByRole('button', { name: 'Play' }).click({ timeout: 120000 })
  const canvas = page.locator('canvas[data-ready="1"]')
  await canvas.waitFor({ state: 'attached', timeout: 120000 })
  await page.evaluate(() => new Promise((d) => { let n = 0; const s = () => (++n >= 30 ? d() : requestAnimationFrame(s)); requestAnimationFrame(s) }))
  await page.addStyleTag({ content: '[data-layer="screens"] { visibility: hidden !important }' })
  const png = await canvas.screenshot()
  writeFileSync(join(out, `${i}.png`), png)
  const stats = await page.evaluate(async (b64) => {
    const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode()
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
    const g = c.getContext('2d'); g.drawImage(img, 0, 0)
    const mean = (x0, x1, y0, y1) => { const d = g.getImageData(img.width * x0, img.height * y0, img.width * (x1 - x0), img.height * (y1 - y0)).data; const m = [0, 0, 0]; const n = d.length / 4; for (let k = 0; k < d.length; k += 4) for (let q = 0; q < 3; q++) m[q] += d[k + q] / n; return m.map((x) => Math.round(x)) }
    return { wall: mean(0.25, 0.35, 0.2, 0.4), floor: mean(0.3, 0.7, 0.75, 0.9) }
  }, png.toString('base64'))
  console.log(i, JSON.stringify(v), JSON.stringify(stats))
  await page.close()
}
await browser.close(); stop(); process.exit(0)

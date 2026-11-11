// Spike clinic: one frame to a file, for looking while the scene is being worked on.
//   node spikes/clinic/one.mjs "<query>" <out.png>      e.g. "frame=play-hall&pref=webgl&debug=nolook"
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { join } from 'node:path'
const repo = new URL('../..', import.meta.url).pathname
const { chromium } = createRequire(join(repo, 'packages/3d/package.json'))('playwright')
const port = await new Promise((r) => { const s = createServer().listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => r(port)) }) })
const server = spawn('pnpm', ['exec', 'vite', '--config', join(repo, 'spikes/clinic/vite.config.ts'), '--port', String(port), '--strictPort'], { cwd: join(repo, 'examples/3d'), stdio: ['ignore', 'pipe', 'pipe'], detached: true })
let log = ''; server.stdout.on('data', (d) => (log += d)); server.stderr.on('data', (d) => (log += d))
const stop = () => { try { process.kill(-server.pid, 'SIGTERM') } catch {} }; process.on('exit', stop)
for (let i = 0; i < 120 && !log.includes('Local:'); i++) await new Promise((r) => setTimeout(r, 500))
const browser = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 })
page.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 300)))
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && console.log(m.type(), m.text().slice(0, 200)))
const t = Date.now()
await page.goto(`http://localhost:${port}/?${process.argv[2]}`)
await page.getByRole('button', { name: 'Play' }).click({ timeout: 120000 })
const canvas = page.locator('canvas[data-ready="1"]')
await canvas.waitFor({ state: 'attached', timeout: 120000 })
await page.evaluate(() => new Promise((done) => { let n = 0; const FRAMES = 40; const tick = () => (++n >= FRAMES ? done() : requestAnimationFrame(tick)); requestAnimationFrame(tick) }))
console.log(JSON.stringify(await canvas.evaluate((c) => ({ ...c.dataset }))), `${Date.now() - t} ms`)
console.log(JSON.stringify(await page.evaluate(() => { const c = window.__camera; return { pos: [c.position.x, c.position.y, c.position.z], fov: c.fov, near: c.near, far: c.far, aspect: c.aspect, mode: c.mode } })))
await page.addStyleTag({ content: '[data-layer="screens"] { visibility: hidden !important }' })
writeFileSync(process.argv[3], await canvas.screenshot({ timeout: 120000 }))
await browser.close(); stop(); process.exit(0)

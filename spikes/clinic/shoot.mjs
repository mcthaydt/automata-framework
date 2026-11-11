// Spike clinic: the batch-1 frames of the converted clinic, on WebGL and on WebGPU (headless Chromium, SwiftShader). One PNG
// a frame and renderer, `<frame>[-turned]-<renderer>.png`, and where the source game's baseline frame exists
// (<REFERENCE>/<spot>-off.png, hall, ward, corridor and supply) one side-by-side `<frame>-compare.png`:
// the source's baseline | AF WebGL | AF WebGPU. The baselines are read from REFERENCE, a local checkout of the source
// game's baseline folder, and are only shown beside the AF frame; nothing is copied.
//
//   ln -sfn ../../examples/3d/node_modules spikes/clinic/node_modules   # once; git-ignored
//   REFERENCE=<source>/docs/verification/baselines/clinic node spikes/clinic/shoot.mjs [out dir]
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { join } from 'node:path'

const repo = new URL('../..', import.meta.url).pathname
const require = createRequire(join(repo, 'packages/3d/package.json'))
const { chromium } = require('playwright')

const out = process.argv[2] ?? join(repo, 'docs/refactor/clinic/batch1')
const reference = process.env.REFERENCE
const free = () => new Promise((resolve) => { const s = createServer().listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)) }) })
const port = process.env.PORT ? Number(process.env.PORT) : await free()
mkdirSync(out, { recursive: true })

const server = spawn('pnpm', ['exec', 'vite', '--config', join(repo, 'spikes/clinic/vite.config.ts'), '--port', String(port), '--strictPort'], { cwd: join(repo, 'examples/3d'), stdio: ['ignore', 'pipe', 'pipe'], detached: true })
let log = ''
server.stdout.on('data', (d) => (log += d))
server.stderr.on('data', (d) => (log += d))
const stop = () => { try { process.kill(-server.pid, 'SIGTERM') } catch {} }
process.on('exit', stop)
for (let i = 0; i < 120 && !log.includes('Local:'); i++) await new Promise((r) => setTimeout(r, 500))
if (!log.includes('Local:')) throw new Error(`vite did not start:\n${log}`)

// Vulkan on SwiftShader lets Chromium present a WebGPU canvas here (see spikes/eb-look).
// One browser a shot: a WebGPU page that has been closed can take a shared browser's GPU process down with it.
const ARGS = ['--enable-unsafe-webgpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader']
const browser = await chromium.launch({ args: ARGS })
const FRAMES = [
  ['zone-hall', false], ['zone-corridor', false], ['zone-closet', false],
  ['play-hall', false], ['play-ward', false], ['play-corridor', false], ['play-supply', false],
  ['play-hall', true], ['play-ward', true], ['play-corridor', true], ['play-supply', true],
]
const facts = []

async function shoot(frame, turned, pref) {
  const own = await chromium.launch({ args: ARGS })
  const page = await own.newPage({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(m.text().slice(0, 300)))
  await page.goto(`http://localhost:${port}/?frame=${frame}&turned=${turned ? 1 : 0}&pref=${pref}`)
  const canvas = page.locator('canvas[data-ready="1"]')
  try {
    await page.getByRole('button', { name: 'Play' }).click({ timeout: 120000 })
    await page.locator('[data-layer="screens"] [data-screen="play"]').waitFor({ state: 'attached', timeout: 120000 })
    await canvas.waitFor({ state: 'attached', timeout: 120000 })
  } catch {
    await own.close()
    return { png: null, data: {}, errors }
  }
  // Readiness, not a sleep: let the camera cut onto the player and the passes run for a number of frames.
  await page.evaluate(() => new Promise((done) => { let n = 0; const FRAMES = 40; const tick = () => (++n >= FRAMES ? done() : requestAnimationFrame(tick)); requestAnimationFrame(tick) }))
  const data = await canvas.evaluate((c) => ({ ...c.dataset }))
  await page.addStyleTag({ content: '[data-layer="screens"] { visibility: hidden !important }' })
  const png = await canvas.screenshot({ timeout: 120000 })
  await own.close()
  return { png, data, errors }
}

const compose = await browser.newPage()
async function sideBySide(panels) {
  return compose.evaluate(async (panels) => {
    const w = 1024, h = 768, pad = 8, label = 20
    const c = document.createElement('canvas'); c.width = panels.length * (w + pad) + pad; c.height = h + label + 2 * pad
    const g = c.getContext('2d'); g.fillStyle = '#111'; g.fillRect(0, 0, c.width, c.height)
    for (const [i, p] of panels.entries()) {
      const x = pad + i * (w + pad)
      g.fillStyle = '#eee'; g.font = '14px monospace'; g.fillText(p.title, x, pad + 14)
      if (p.b64 === null) { g.fillStyle = '#333'; g.fillRect(x, pad + label, w, h); g.fillStyle = '#aaa'; g.fillText('no frame', x + 20, pad + label + 40); continue }
      const img = new Image(); img.src = `data:image/png;base64,${p.b64}`; await img.decode()
      g.drawImage(img, x, pad + label, w, h)
    }
    return c.toDataURL('image/png').split(',')[1]
  }, panels)
}

for (const [frame, turned] of FRAMES) {
  const stem = `${frame}${turned ? '-turned' : ''}`
  // ONLY=<stem>,<stem> shoots just those frames, so a long run can be done in parts.
  if (process.env.ONLY && !process.env.ONLY.split(',').includes(stem)) continue
  const shots = {}
  for (const pref of ['webgl', 'webgpu']) {
    const shot = await shoot(frame, turned, pref)
    shots[pref] = shot
    if (shot.png !== null) writeFileSync(join(out, `${stem}-${pref}.png`), shot.png)
    facts.push({ frame: stem, pref, renderer: shot.data.renderer ?? 'failed', pieces: shot.data.pieces, problems: shot.data.problems, problemCodes: shot.data.problemCodes, lamps: shot.data.lamps, errors: shot.errors.slice(0, 3) })
    console.log(stem, pref, shot.data.renderer ?? 'FAILED', shot.errors.slice(0, 1).join(' | '))
  }
  const spot = frame.startsWith('play-') ? frame.slice(5) : undefined
  const baseline = reference && spot && !turned ? join(reference, `${spot}-off.png`) : undefined
  const panels = [
    { title: baseline && existsSync(baseline) ? 'source game baseline (effects off, with its HUD)' : `${stem}: no baseline frame`, b64: baseline && existsSync(baseline) ? readFileSync(baseline).toString('base64') : null },
    { title: 'AF WebGL', b64: shots.webgl.png?.toString('base64') ?? null },
    { title: 'AF WebGPU', b64: shots.webgpu.png?.toString('base64') ?? null },
  ]
  writeFileSync(join(out, `${stem}-compare.png`), Buffer.from(await sideBySide(panels), 'base64'))
}
writeFileSync(join(out, 'shots.json'), `${JSON.stringify(facts, null, 2)}\n`)
await browser.close()
stop()
process.exit(0)

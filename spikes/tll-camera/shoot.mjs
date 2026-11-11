// Spike tll-camera: screenshots of the base interior and exterior from the default gameplay camera at each of the eight
// 45° steps of the player's turn. One PNG a scene and step (`<scene>-step<N>-<deg>deg.png`, the game's own field,
// upscaled ×SCALE nearest) and one contact sheet a scene (`<scene>-sheet.png`).
//
//   ln -sfn ../../examples/3d/node_modules spikes/tll-camera/node_modules   # once; git-ignored
//   node spikes/tll-camera/shoot.mjs [out dir]     # default docs/refactor/eb-look/camera; DISTANCE=<m> for another distance
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { join } from 'node:path'

const repo = new URL('../..', import.meta.url).pathname
const require = createRequire(join(repo, 'packages/3d/package.json'))
const { chromium } = require('playwright')

const out = process.argv[2] ?? join(repo, 'docs/refactor/eb-look/camera')
const SCALE = Number(process.env.SCALE ?? 2)
// A free port, asked of the system: nothing here owns one.
const port = await new Promise((resolve) => {
  const probe = createServer().listen(0, () => {
    const { port: free } = probe.address()
    probe.close(() => resolve(free))
  })
})
const extra = process.env.DISTANCE ? `&distance=${process.env.DISTANCE}` : ''
const SCENES = ['base-interior', 'base-exterior']
const FIELD = { 'base-interior': [512, 320], 'base-exterior': [640, 360] }
mkdirSync(out, { recursive: true })

const server = spawn(
  'pnpm',
  ['exec', 'vite', '--config', join(repo, 'spikes/tll-camera/vite.config.ts'), '--port', String(port), '--strictPort'],
  { cwd: join(repo, 'examples/3d'), stdio: ['ignore', 'pipe', 'pipe'], detached: true },
)
let log = ''
server.stdout.on('data', (d) => (log += d))
server.stderr.on('data', (d) => (log += d))
const stop = () => { try { process.kill(-server.pid, 'SIGTERM') } catch {} }
process.on('exit', stop)
for (let i = 0; i < 120 && !log.includes('Local:'); i++) await new Promise((r) => setTimeout(r, 500))
if (!log.includes('Local:')) throw new Error(`vite did not start:\n${log}`)

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const facts = []

async function shoot(scene, step) {
  const [width, height] = FIELD[scene]
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(m.text().slice(0, 300)))
  await page.goto(`http://localhost:${port}/?scene=${scene}&step=${step}${extra}`)
  const canvas = page.locator('canvas[data-ready="1"]')
  try {
    await page.getByRole('button', { name: 'Play' }).click({ timeout: 60000 })
    await page.locator('[data-layer="screens"] [data-screen="play"]').waitFor({ state: 'attached', timeout: 60000 })
    await canvas.waitFor({ state: 'attached', timeout: 60000 })
  } catch (error) {
    const body = await page.evaluate(() => document.body.innerText.slice(0, 400)).catch(() => '')
    throw new Error(`${scene} step ${step}: body: ${body}\n ${error.message.split('\n')[0]}\npage errors: ${errors.join(' | ')}\nvite: ${log.slice(-600)}`)
  }
  // Readiness, not a sleep: let the camera cut onto the player and the passes run for a number of frames.
  await page.evaluate(() => new Promise((done) => { let n = 0; const tick = () => (++n >= 40 ? done() : requestAnimationFrame(tick)); requestAnimationFrame(tick) }))
  const data = await canvas.evaluate((c) => ({ ...c.dataset }))
  await page.addStyleTag({ content: '[data-layer="screens"] { visibility: hidden !important }' })
  const png = await canvas.screenshot()
  await page.close()
  return { png, data, errors }
}

const compose = await browser.newPage()
const scaleUp = (b64, w, h) =>
  compose.evaluate(async ({ b64, w, h, scale }) => {
    const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode()
    const c = document.createElement('canvas'); c.width = w * scale; c.height = h * scale
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL('image/png').split(',')[1]
  }, { b64, w, h, scale: SCALE })

for (const scene of SCENES) {
  const [w, h] = FIELD[scene]
  const panels = []
  for (let step = 0; step < 8; step++) {
    const shot = await shoot(scene, step)
    const deg = step * 45
    const b64 = await scaleUp(shot.png.toString('base64'), w, h)
    writeFileSync(join(out, `${scene}-step${step}-${String(deg).padStart(3, '0')}deg.png`), Buffer.from(b64, 'base64'))
    panels.push({ title: `${scene}  step ${step}  heading ${deg}°`, b64 })
    facts.push({ scene, step, ...shot.data, errors: shot.errors })
    console.log(scene, step, JSON.stringify(shot.data), shot.errors.slice(0, 2).join(' | '))
  }
  // The sheet panels are already ×SCALE: compose them at 1×.
  const sheetB64 = await compose.evaluate(async ({ panels, w, h }) => {
    const pad = 8, label = 18, cols = 4, rows = Math.ceil(panels.length / cols)
    const c = document.createElement('canvas')
    c.width = cols * (w + pad) + pad; c.height = rows * (h + label + pad) + pad
    const g = c.getContext('2d'); g.fillStyle = '#111'; g.fillRect(0, 0, c.width, c.height)
    for (const [i, p] of panels.entries()) {
      const x = pad + (i % cols) * (w + pad), y = pad + Math.floor(i / cols) * (h + label + pad)
      g.fillStyle = '#eee'; g.font = '13px monospace'; g.fillText(p.title, x, y + 13)
      const img = new Image(); img.src = `data:image/png;base64,${p.b64}`; await img.decode()
      g.drawImage(img, x, y + label)
    }
    return c.toDataURL('image/png').split(',')[1]
  }, { panels, w: w * SCALE, h: h * SCALE })
  writeFileSync(join(out, `${scene}-sheet.png`), Buffer.from(sheetB64, 'base64'))
}
writeFileSync(join(out, 'shots.json'), `${JSON.stringify(facts, null, 2)}\n`)
await browser.close()
stop()
process.exit(0)

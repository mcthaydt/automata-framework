// Spike eb-look: the baseline screenshots. Serves scene.ts, draws each base scene in the diorama and first person on
// WebGL and on WebGPU (headless Chromium, SwiftShader), and writes one side-by-side PNG per scene and view:
// EnvironmentBuilder's CPU frame | AF WebGL (baked room light) | AF WebGL (material light only) | AF WebGPU, each nearest-scaled ×SCALE. EB's frames are read from
// EB_DIR (`<scene>-<view>.png` at 1×, as EB's `npm run render` writes them without the -x suffix); a missing one is a
// grey panel that says so. Then one sheet a scene of the gameplay cameras (`af`, `tll` in scene.ts) on WebGL.
//
//   ln -sfn ../../examples/3d/node_modules spikes/eb-look/node_modules   # once; git-ignored
//   EB_DIR=<dir> node spikes/eb-look/shoot.mjs [out dir]                 # default docs/refactor/eb-look/baseline
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const repo = new URL('../..', import.meta.url).pathname
const require = createRequire(join(repo, 'packages/3d/package.json'))
const { chromium } = require('playwright')

const out = process.argv[2] ?? join(repo, 'docs/refactor/eb-look/baseline')
const ebDir = process.env.EB_DIR
const SCALE = Number(process.env.SCALE ?? 2)
const port = Number(process.env.PORT ?? 5391)
const SCENES = ['base-interior', 'base-interior-dressed', 'base-exterior', 'base-exterior-dressed']
const VIEWS = ['diorama', 'fp']
// The AF panels: the renderer asked for, and switches (scene.ts). `light=0` leaves out the level's baked room light, so
// the ramp material lights by the time of day alone.
const PANELS = [
  { pref: 'webgl', extra: '', title: 'AF WebGL, baked room light' },
  { pref: 'webgl', extra: '&light=0', title: 'AF WebGL, material light only' },
  { pref: 'webgpu', extra: '', title: 'AF WebGPU, baked room light' },
]
mkdirSync(out, { recursive: true })

const server = spawn(
  'pnpm',
  ['exec', 'vite', '--config', join(repo, 'spikes/eb-look/vite.config.ts'), '--port', String(port), '--strictPort'],
  { cwd: join(repo, 'examples/3d'), stdio: ['ignore', 'pipe', 'pipe'], detached: true },
)
let log = ''
server.stdout.on('data', (d) => (log += d))
server.stderr.on('data', (d) => (log += d))
// pnpm exec leaves vite running on a plain kill: stop the whole group.
const stop = () => { try { process.kill(-server.pid, 'SIGTERM') } catch {} }
process.on('exit', stop)
for (let i = 0; i < 120 && !log.includes('Local:'); i++) await new Promise((r) => setTimeout(r, 500))
if (!log.includes('Local:')) throw new Error(`vite did not start:\n${log}`)

// Vulkan on SwiftShader is what lets Chromium present a WebGPU canvas here: without it the GPU process cannot make the
// swap chain's shared image ("Could not find SharedImageBackingFactory ... WebgpuSwapChainTexture") and the device is
// lost on the first frame, with or without a mesh (docs/refactor/eb-look/wp0/README.md).
const browser = await chromium.launch({
  args: ['--enable-unsafe-webgpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader'],
})
const facts = []

const FIELD = { 'base-interior': [512, 320], 'base-exterior': [640, 360] }
const fieldOf = (scene, view) =>
  view === 'fp' ? [320, 200] : view === 'af' || view === 'tll' ? [320, 180] : FIELD[scene.replace('-dressed', '')]
async function shoot(scene, view, pref, extra) {
  // The viewport is the logical field, so the letterbox draws it 1:1.
  const [width, height] = fieldOf(scene, view)
  const page = await browser.newPage({ viewport: { width: width * 2, height: height * 2 }, deviceScaleFactor: 1 })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(m.text().slice(0, 300)))
  await page.goto(`http://localhost:${port}/?scene=${scene}&view=${view}&pref=${pref}${extra}`)
  const canvas = page.locator('canvas[data-ready="1"]')
  try {
    // Past the default title screen into play.
    await page.getByRole('button', { name: 'Play' }).click({ timeout: 120000 })
    await page.locator('[data-layer="screens"] [data-screen="play"]').waitFor({ state: 'attached', timeout: 120000 })
    await canvas.waitFor({ state: 'attached', timeout: 120000 })
  } catch {
    await page.close()
    return { png: null, renderer: 'failed', errors }
  }
  // Readiness, not a sleep: let the views pose and the passes run for a number of frames.
  await page.evaluate(() => new Promise((done) => { let n = 0; const step = () => (++n >= 30 ? done() : requestAnimationFrame(step)); requestAnimationFrame(step) }))
  const data = await canvas.evaluate((c) => ({ ...c.dataset }))
  // The pause button and any notice sit over the field: hidden for the picture only.
  await page.addStyleTag({ content: '[data-layer="screens"] { visibility: hidden !important }' })
  // The game draws at its logical size and the letterbox upscales whole pixels: read back the logical field.
  const png = await canvas.screenshot({ timeout: 120000 })
  await page.close()
  return { png, renderer: data.renderer, data, errors }
}

const compose = await browser.newPage()
// Every panel is drawn at the field's size × SCALE: EB's 1× frame nearest-scaled, AF's canvas (the field × 2) as it is.
async function sideBySide(panels, w, h) {
  return compose.evaluate(
    async ({ panels, w, h, scale }) => {
      const pad = 8, label = 18
      const c = document.createElement('canvas')
      c.width = panels.length * (w * scale + pad) + pad
      c.height = h * scale + label + pad * 2
      const g = c.getContext('2d')
      g.fillStyle = '#111'; g.fillRect(0, 0, c.width, c.height)
      g.imageSmoothingEnabled = false
      for (const [i, p] of panels.entries()) {
        const x = pad + i * (w * scale + pad), y = label + pad
        g.fillStyle = '#eee'; g.font = '13px monospace'; g.fillText(p.title, x, 15)
        if (p.b64 === null) {
          g.fillStyle = '#333'; g.fillRect(x, y, w * scale, h * scale)
          g.fillStyle = '#aaa'; g.fillText(p.missing, x + 10, y + 24)
          continue
        }
        const img = new Image(); img.src = `data:image/png;base64,${p.b64}`; await img.decode()
        g.drawImage(img, x, y, w * scale, h * scale)
      }
      return c.toDataURL('image/png').split(',')[1]
    },
    { panels, w, h, scale: SCALE },
  )
}

for (const scene of SCENES)
  for (const view of VIEWS) {
    const ebFile = ebDir && join(ebDir, `${scene}-${view}.png`)
    const eb = ebFile && existsSync(ebFile) ? readFileSync(ebFile).toString('base64') : null
    const panels = [{ title: 'EB CPU', b64: eb, missing: 'EnvironmentBuilder frame not rendered (see gap.md)' }]
    const [w, h] = fieldOf(scene, view)
    for (const { pref, extra, title } of PANELS) {
      const shot = await shoot(scene, view, pref, extra)
      const lost = shot.data?.lost ? ', device lost' : ''
      panels.push({ title: `${title} (drew: ${shot.renderer}${lost})`, b64: shot.png?.toString('base64') ?? null, missing: `failed: ${shot.errors[0] ?? ''}`.slice(0, 80) })
      facts.push({ scene, view, asked: pref, extra, ...shot.data, renderer: shot.renderer, errors: shot.errors })
      console.log(scene, view, pref, '->', shot.renderer, shot.data ? JSON.stringify(shot.data) : '', shot.errors.slice(0, 2).join(' | '))
    }
    const b64 = await sideBySide(panels, w, h)
    writeFileSync(join(out, `${scene}-${view}.png`), Buffer.from(b64, 'base64'))
  }
// The gameplay cameras: AF's default view beside The Last Light's play camera, on WebGL, both lights.
for (const scene of SCENES) {
  const panels = []
  for (const view of ['af', 'tll'])
    for (const { pref, extra, title } of PANELS.filter((p) => p.pref === 'webgl')) {
      const shot = await shoot(scene, view, pref, extra)
      const camera = view === 'af' ? 'AF default camera (24 mm, 25°, 5 m)' : 'TLL play camera (50 mm, 30°, 16 m)'
      panels.push({ title: `${camera}, ${title.replace('AF WebGL, ', '')}`, b64: shot.png?.toString('base64') ?? null, missing: `failed: ${shot.errors[0] ?? ''}`.slice(0, 80) })
      facts.push({ scene, view, asked: pref, extra, ...shot.data, renderer: shot.renderer, errors: shot.errors })
      console.log(scene, view, pref, extra, '->', shot.renderer)
    }
  const b64 = await sideBySide(panels, 320, 180)
  writeFileSync(join(out, `${scene}-gameplay.png`), Buffer.from(b64, 'base64'))
}
writeFileSync(join(out, 'shots.json'), `${JSON.stringify(facts, null, 2)}\n`)
await browser.close()
stop()
process.exit(0)

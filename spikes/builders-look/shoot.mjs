// The survey's sheets (2026-11-11-builders-look-survey.md): the builders' own frames beside what `main` draws today.
// It drives the page of spikes/eb-look (scene.ts, unchanged) in headless Chromium on software WebGL, and writes:
//   <scene>-<view>.png     EnvironmentBuilder's CPU frame | AF, baked room light | AF, material light only
//   <scene>-gameplay.png   AF's default gameplay camera (50 mm, 30°, 16 m), both lights; the builders draw no such view
//   figures-*.png          FigureBuilder's base pair and its lit sheet; AF's painted figures (characterkit-painted)
//   shots.json             what each panel drew, its mean brightness (0 to 255) and its count of colours
//
// The builders' own frames are in the survey's builders/ folder (EnvironmentBuilder f7c5356: `npm run render -- dir`;
// FigureBuilder 23f889c: `DENSITY=2 npm run render -- dir` and `npm run lit -- dir/lit`), so a later shoot needs
// neither repository. A second argument names another folder of such frames.
//
// It lives in spikes/ (which knip and biome leave alone, as they do every spike) and writes into the survey's folder,
// docs/superpowers/audits/builders-look-survey/, unless told another.
//
//   ln -sfn ../../examples/3d/node_modules spikes/eb-look/node_modules      # once; git-ignored
//   pnpm --filter @af-examples/examples-3d build                            # for figures-af-painted.png
//   node spikes/builders-look/shoot.mjs [out dir] [builders' frames dir]
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { extname, join } from 'node:path'

const repo = new URL('../..', import.meta.url).pathname
const require = createRequire(join(repo, 'packages/3d/package.json'))
const { chromium } = require('playwright')
const survey = join(repo, 'docs/superpowers/audits/builders-look-survey')
const out = process.argv[2] ?? survey
const EB_DIR = process.argv[3] ?? join(survey, 'builders')
const FB_DIR = EB_DIR
mkdirSync(out, { recursive: true })
const SCENES = ['base-interior', 'base-interior-dressed', 'base-exterior', 'base-exterior-dressed']
const LIGHTS = [
  { extra: '', title: 'AF main, baked room light' },
  { extra: '&light=0', title: 'AF main, material light only' },
]
const FIELD = { 'base-interior': [512, 320], 'base-exterior': [640, 360] }
const fieldOf = (scene, view) =>
  view === 'fp' ? [320, 200] : view === 'tll' ? [320, 180] : FIELD[scene.replace('-dressed', '')]

/** Serves a folder on a port the OS picks. */
const serve = (root) =>
  new Promise((resolve) => {
    const types = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
    }
    const server = createServer((request, response) => {
      let path = join(root, decodeURIComponent(new URL(request.url, 'http://x').pathname))
      if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html')
      if (!existsSync(path)) return response.writeHead(404).end()
      response.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' })
      response.end(readFileSync(path))
    }).listen(0, '127.0.0.1', () => resolve(server))
  })

// A free port the OS picks, so two copies never collide and the repo names no port of its own.
const port = await new Promise((resolve) => {
  const probe = createServer().listen(0, '127.0.0.1', () => {
    const { port: free } = probe.address()
    probe.close(() => resolve(free))
  })
})
const vite = spawn(
  'pnpm',
  [
    'exec',
    'vite',
    '--config',
    join(repo, 'spikes/eb-look/vite.config.ts'),
    '--port',
    String(port),
    '--strictPort',
  ],
  { cwd: join(repo, 'examples/3d'), stdio: ['ignore', 'pipe', 'pipe'], detached: true },
)
let log = ''
vite.stdout.on('data', (d) => (log += d))
vite.stderr.on('data', (d) => (log += d))
// pnpm exec leaves vite running on a plain kill: stop the whole group.
const stop = () => {
  try {
    process.kill(-vite.pid, 'SIGTERM')
  } catch {}
}
process.on('exit', stop)
const local = () => `http://localhost:${port}`
for (let i = 0; i < 240 && !log.includes('Local:'); i++) await new Promise((r) => setTimeout(r, 500))
if (!log.includes('Local:')) throw new Error(`vite did not start:\n${log}`)

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const facts = []

/** One page past its title screen, drawn for 30 frames, as a PNG of its game canvas. */
async function shoot(url, [width, height]) {
  const page = await browser.newPage({
    viewport: { width: width * 2, height: height * 2 },
    deviceScaleFactor: 1,
  })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 300)))
  await page.goto(url)
  await page.getByRole('button', { name: 'Play' }).click({ timeout: 120000 })
  await page
    .locator('[data-layer="screens"] [data-screen="play"]')
    .waitFor({ state: 'attached', timeout: 120000 })
  // Readiness, not a sleep: the views pose and the passes run for a number of frames.
  await page.evaluate(
    () =>
      new Promise((done) => {
        let n = 0
        const step = () => (++n >= 30 ? done() : requestAnimationFrame(step))
        requestAnimationFrame(step)
      }),
  )
  await page.addStyleTag({ content: '[data-layer="screens"] { visibility: hidden !important }' })
  const png = await page.locator('canvas').first().screenshot({ timeout: 120000 })
  await page.close()
  return { b64: png.toString('base64'), errors: [...new Set(errors)] }
}

const compose = await browser.newPage()
/** Panels side by side, each nearest-scaled to w × h × scale, with its mean brightness and its count of colours. */
const sheet = (panels, w, h, scale) =>
  compose.evaluate(
    async ({ panels, w, h, scale }) => {
      const pad = 8
      const label = 18
      const c = document.createElement('canvas')
      c.width = panels.length * (w * scale + pad) + pad
      c.height = h * scale + label + pad * 2
      const g = c.getContext('2d')
      g.fillStyle = '#111'
      g.fillRect(0, 0, c.width, c.height)
      g.imageSmoothingEnabled = false
      const measures = []
      for (const [i, p] of panels.entries()) {
        const x = pad + i * (w * scale + pad)
        const y = label + pad
        g.fillStyle = '#eee'
        g.font = '13px monospace'
        g.fillText(p.title, x, 15)
        if (p.b64 === null) {
          g.fillStyle = '#333'
          g.fillRect(x, y, w * scale, h * scale)
          measures.push(null)
          continue
        }
        const img = new Image()
        img.src = `data:image/png;base64,${p.b64}`
        await img.decode()
        // Measured at the field's own size, before the panel is scaled up.
        const one = document.createElement('canvas')
        one.width = w
        one.height = h
        const g1 = one.getContext('2d')
        g1.imageSmoothingEnabled = false
        g1.drawImage(img, 0, 0, w, h)
        const data = g1.getImageData(0, 0, w, h).data
        const colours = new Set()
        let total = 0
        for (let k = 0; k < data.length; k += 4) {
          total += (data[k] + data[k + 1] + data[k + 2]) / 3
          colours.add((data[k] << 16) | (data[k + 1] << 8) | data[k + 2])
        }
        measures.push({
          brightness: Math.round((total / (data.length / 4)) * 10) / 10,
          colours: colours.size,
        })
        g.drawImage(one, x, y, w * scale, h * scale)
      }
      return { b64: c.toDataURL('image/png').split(',')[1], measures }
    },
    { panels, w, h, scale },
  )
const fileB64 = (dir, name) =>
  dir && existsSync(join(dir, name)) ? readFileSync(join(dir, name)).toString('base64') : null

async function write(name, panels, [w, h], scale, record) {
  const { b64, measures } = await sheet(panels, w, h, scale)
  writeFileSync(join(out, name), Buffer.from(b64, 'base64'))
  for (const [i, p] of panels.entries())
    facts.push({ sheet: name, panel: p.title, ...record, ...measures[i], errors: p.errors ?? [] })
  console.log(name, JSON.stringify(measures))
}

for (const scene of SCENES) {
  for (const view of ['diorama', 'fp']) {
    const panels = [{ title: "EnvironmentBuilder's CPU frame", b64: fileB64(EB_DIR, `${scene}-${view}.png`) }]
    for (const { extra, title } of LIGHTS)
      panels.push({
        title,
        ...(await shoot(`${local()}/?scene=${scene}&view=${view}&pref=webgl${extra}`, fieldOf(scene, view))),
      })
    await write(`${scene}-${view}.png`, panels, fieldOf(scene, view), view === 'fp' ? 2 : 1, { scene, view })
  }
  const panels = []
  for (const { extra, title } of LIGHTS)
    panels.push({
      title: `${title} (50 mm, 30°, 16 m)`,
      ...(await shoot(`${local()}/?scene=${scene}&view=tll&pref=webgl${extra}`, [320, 180])),
    })
  await write(`${scene}-gameplay.png`, panels, [320, 180], 2, { scene, view: 'gameplay' })
}

// The figures: the builder's base pair at density 2 and its lit sheet, beside the kit's painted figures on main.
const dist = join(repo, 'examples/3d/dist')
if (existsSync(join(dist, 'characterkit/painted/index.html'))) {
  const server = await serve(dist)
  const painted = await shoot(`http://127.0.0.1:${server.address().port}/characterkit/painted/`, [720, 405])
  server.close()
  await write(
    'figures-af-painted.png',
    [{ title: 'AF main: characterkit-painted (720 × 405)', ...painted }],
    [720, 405],
    1,
    { view: 'figures' },
  )
}
for (const who of ['base-m', 'base-f'])
  await write(
    `figures-fb-${who}.png`,
    [{ title: `FigureBuilder ${who}, 8 views, density 2`, b64: fileB64(FB_DIR, `${who}-turn.png`) }],
    [1024, 192],
    1,
    { view: 'figures' },
  )
await write(
  'figures-fb-lit.png',
  [{ title: "FigureBuilder's lit sheet", b64: fileB64(FB_DIR, 'lit/lit-sheet.png') }],
  [858, 1728],
  1,
  { view: 'figures' },
)

writeFileSync(join(out, 'shots.json'), `${JSON.stringify(facts, null, 2)}\n`)
await browser.close()
stop()
process.exit(0)

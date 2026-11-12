// The survey's sheets (2026-11-11-builders-look-survey.md): the builders' own frames beside what `main` draws today.
// It drives the page of spikes/eb-look (scene.ts, unchanged) in headless Chromium on software WebGL, and writes:
//   <scene>-<view>.png     EnvironmentBuilder's CPU frame | AF, baked room light | AF, material light only
//   <scene>-gameplay.png   AF's default gameplay camera (50 mm, 30°, 16 m), both lights; the builders draw no such view
//   <scene>-zone.png       the same camera at the distance the base scene's room view names (#589)
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
//   node spikes/builders-look/shoot.mjs [out dir] [builders' frames dir] [query text]
// The third argument is added to every scene's URL (`figures=painted`, `fx=0`); with it the figures-* sheets are not shot again.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { extname, join } from 'node:path'

const repo = new URL('../..', import.meta.url).pathname
const require = createRequire(join(repo, 'packages/3d/package.json'))
const { chromium } = require('playwright')
const survey = join(repo, 'docs/superpowers/audits/builders-look-survey')
// The world kit's own readability measure (it imports nothing, so Node runs the TypeScript as it is).
const { figureReads } = await import(join(repo, 'extensions/world-kit/src/features/reads/figure-reads.ts'))
const out = process.argv[2] ?? survey
const EB_DIR = process.argv[3] ?? join(survey, 'builders')
const FB_DIR = EB_DIR
const QUERY = process.argv[4] === undefined ? '' : `&${process.argv[4]}`
// `reads.json` (READS_ONLY=1, with `figures=painted`): each baked-light panel is shot again without the cast (`cast=0`), a figure's
// texels are the pixels the two frames do not share, and the file holds how each reads against its ring (the builder's exposure window).
const HOT = 1.1
const MIN_FIGURE = 500
const MIN_EDGE = 1.1
const reads = []
mkdirSync(out, { recursive: true })
const ALL_SCENES = ['base-interior', 'base-interior-dressed', 'base-exterior', 'base-exterior-dressed']
// SCENES=base-exterior,base-exterior-dressed shoots only those (a run that stopped is picked up again); shots.json keeps the others' facts.
const SCENES = process.env.SCENES === undefined ? ALL_SCENES : ALL_SCENES.filter((s) => process.env.SCENES.split(',').includes(s))
const LIGHTS = [
  { extra: '', title: 'AF main, baked room light' },
  { extra: '&light=0', title: 'AF main, material light only' },
]
const FIELD = { 'base-interior': [512, 320], 'base-exterior': [640, 360] }
const fieldOf = (scene, view) =>
  view === 'fp' ? [320, 200] : view === 'af' || view === 'zone' ? [320, 180] : FIELD[scene.replace('-dressed', '')]

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
/** A shot's pixels at the field's size, four bytes each. */
const pixelsOf = (b64, w, h) =>
  compose.evaluate(
    async ({ b64, w, h }) => {
      const img = new Image()
      img.src = `data:image/png;base64,${b64}`
      await img.decode()
      const one = document.createElement('canvas')
      one.width = w
      one.height = h
      const g = one.getContext('2d')
      g.imageSmoothingEnabled = false
      g.drawImage(img, 0, 0, w, h)
      return Array.from(g.getImageData(0, 0, w, h).data)
    },
    { b64, w, h },
  )

/**
 * How each figure in `withCast` reads against its ring: its texels are the pixels that differ from `without`. `figureReads`
 * takes two depth buffers; here the scene's is 0 everywhere and the frame's is 1 where a figure is.
 */
async function readsOf(withCast, without, [w, h], record) {
  const [a, b] = await Promise.all([pixelsOf(withCast, w, h), pixelsOf(without, w, h)])
  const frameDepth = new Float32Array(w * h)
  for (let k = 0; k < w * h; k++)
    for (let c = 0; c < 3; c++) if (a[k * 4 + c] !== b[k * 4 + c]) frameDepth[k] = 1
  // A run under MIN_FIGURE texels is not a figure (the pair are 2,800 texels at the least): it is the scene itself differing between
  // the two page loads (a leaf's sway), which the two frames do not share either.
  const found = figureReads({ width: w, height: h, rgba: a, sceneDepth: new Float32Array(w * h), frameDepth }).filter(
    (f) => f.texels >= MIN_FIGURE,
  )
  for (const [i, f] of found.entries())
    reads.push({
      ...record,
      figure: i,
      texels: f.texels,
      around: Math.round(f.around * 1000) / 1000,
      luma: Math.round(f.figure * 1000) / 1000,
      edge: Math.round(f.edge * 1000) / 1000,
      read: Math.round(f.read * 1000) / 1000,
      hot: f.figure > HOT * f.around,
      reads: f.edge >= MIN_EDGE,
    })
}
const fileB64 = (dir, name) =>
  dir && existsSync(join(dir, name)) ? readFileSync(join(dir, name)).toString('base64') : null

async function write(name, panels, [w, h], scale, record) {
  const { b64, measures } = await sheet(panels, w, h, scale)
  writeFileSync(join(out, name), Buffer.from(b64, 'base64'))
  for (const [i, p] of panels.entries())
    facts.push({ sheet: name, panel: p.title, ...record, ...measures[i], errors: p.errors ?? [] })
  console.log(name, JSON.stringify(measures))
}

// SIZES_ONLY=1 (with `figures=painted`) shoots the gameplay and room views at the old game's picture size (FIELD=640x360 or 640x480)
// with the painted pair at density 1, once in whole pixels a texel and once at true size (`crisp=0`), side by side in one sheet
// per scene and view (`<scene>-<view>-<field>.png`), and writes `sizes.json`: the man's height in picture pixels in each (the
// pixels the frame with the pair differs from the frame without, shadow off in both, in the left cluster of columns) against
// the true one (1.78 m at the 50 mm lens: the field's lines over 0.48 times the camera's distance, a metre).
if (process.env.SIZES_ONLY === '1') {
  const field = (process.env.FIELD ?? '640x360').split('x').map(Number)
  const tag = field.join('x')
  const man = 1.78
  const sizes = []
  /** The rows the pair covers where the two frames differ, as the clusters of columns (a gap of 6 columns parts two figures). */
  const clusters = async (withCast, without) => {
    const [a, b] = await Promise.all([pixelsOf(withCast, ...field), pixelsOf(without, ...field)])
    const [w, h] = field
    const top = new Array(w).fill(h)
    const bottom = new Array(w).fill(-1)
    for (let k = 0; k < w * h; k++) {
      if (a[k * 4] === b[k * 4] && a[k * 4 + 1] === b[k * 4 + 1] && a[k * 4 + 2] === b[k * 4 + 2]) continue
      top[k % w] = Math.min(top[k % w], Math.floor(k / w))
      bottom[k % w] = Math.max(bottom[k % w], Math.floor(k / w))
    }
    const found = []
    let gap = 99
    for (let x = 0; x < w; x++) {
      if (bottom[x] < 0) {
        gap++
        continue
      }
      if (gap > 6) found.push({ from: x, to: x, top: top[x], bottom: bottom[x] })
      const c = found[found.length - 1]
      c.to = x
      c.top = Math.min(c.top, top[x])
      c.bottom = Math.max(c.bottom, bottom[x])
      gap = 0
    }
    return found.filter((c) => c.to - c.from >= 8).map((c) => ({ x: [c.from, c.to], rows: c.bottom - c.top + 1 }))
  }
  for (const scene of SCENES)
    for (const [view, label, distance] of [
      ['af', 'gameplay', 16],
      // The room views name their distances: 9 m (the interior's room), 10.2 m (the street's pavement).
      ['zone', 'zone', scene.startsWith('base-interior') ? 9 : 10.2],
    ].filter(([view]) => process.env.VIEWS === undefined || process.env.VIEWS.split(',').includes(view))) {
      const panels = []
      for (const [crisp, title] of [
        [1, 'density 1, whole pixels a texel'],
        [0, 'density 1, true size (crisp=0)'],
      ]) {
        const url = `${local()}/?scene=${scene}&view=${view}&pref=webgl&density=1&crisp=${crisp}&field=${tag}`
        panels.push({ title: `${title}, ${tag}`, ...(await shoot(`${url}${QUERY}`, field)) })
        // The heights come from the bare scenes only: a dressed scene has the same camera (the props differ, not the lens).
        // (HEIGHTS=1 measures a dressed scene too: a sheet that stands alone, such as the 640 x 480 one, carries its own.)
        if (scene.endsWith('-dressed') && process.env.HEIGHTS !== '1') continue
        const [withPair, without] = [await shoot(`${url}&shadow=0${QUERY}`, field), await shoot(`${url}&shadow=0&cast=0${QUERY}`, field)]
        const found = await clusters(withPair.b64, without.b64)
        sizes.push({ scene, view: label, field: tag, crisp: crisp === 1, figures: found, trueRows: Math.round(((man * field[1]) / (0.48 * distance)) * 10) / 10 })
        writeFileSync(join(out, `sizes-${tag}.json`), `${JSON.stringify(sizes, null, 2)}\n`)
      }
      await write(`${scene}-${label}-${tag}.png`, panels, field, 1, { scene, view: label })
    }
  await browser.close()
  stop()
  process.exit(0)
}

// READ_ONE=<scene>:<view>:<WxH>:<label> (with `figures=painted`, and any query such as `density=1&crisp=0`) shoots that one view with the
// painted pair and again without it (`cast=0`), shadow off in both, keeps both frames (`<label>-with.png`, `<label>-without.png`) and
// writes how each figure reads against its ring (`<label>-reads.json`): the number to put beside the same run on another build.
if (process.env.READ_ONE !== undefined) {
  const [scene, view, fieldText, label] = process.env.READ_ONE.split(':')
  const field = fieldText.split('x').map(Number)
  const url = `${local()}/?scene=${scene}&view=${view}&pref=webgl&field=${fieldText}&shadow=0${QUERY}`
  const withCast = await shoot(url, field)
  const without = await shoot(`${url}&cast=0`, field)
  writeFileSync(join(out, `${label}-with.png`), Buffer.from(withCast.b64, 'base64'))
  writeFileSync(join(out, `${label}-without.png`), Buffer.from(without.b64, 'base64'))
  await readsOf(withCast.b64, without.b64, field, { scene, view, label })
  writeFileSync(join(out, `${label}-reads.json`), `${JSON.stringify(reads, null, 2)}\n`)
  console.log(label, JSON.stringify(reads))
  await browser.close()
  stop()
  process.exit(0)
}

// READS_ONLY=1 shoots only what reads.json needs (the baked-light panel of each scene and view, with and without the cast),
// not the sheets.
if (process.env.READS_ONLY === '1') {
  for (const scene of SCENES)
    for (const [view, size, name] of [
      ['diorama', fieldOf(scene, 'diorama'), 'diorama'],
      ['fp', fieldOf(scene, 'fp'), 'fp'],
      ['af', [320, 180], 'gameplay'],
      ['zone', [320, 180], 'zone'],
    ]) {
      const url = `${local()}/?scene=${scene}&view=${view}&pref=webgl`
      const withCast = await shoot(`${url}${QUERY}`, size)
      const without = await shoot(`${url}&cast=0${QUERY}`, size)
      await readsOf(withCast.b64, without.b64, size, { scene, view: name })
    }
  writeFileSync(join(out, 'reads.json'), `${JSON.stringify(reads, null, 2)}\n`)
  await browser.close()
  stop()
  process.exit(0)
}

// SHADOW_ONLY=1 (with `figures=painted`) shoots each baked-light panel with the cast shadow on and off (`shadow=0`) and writes
// `shadow.json`: the shadow's footprint (the pixels the two frames do not share; a figure is the same in both, so they are the
// floor's) and how much darker it makes them (the mean of luma on over luma off). The builder's own is measured the same way by
// eb-shadow-probe.ts, which draws its frame with `figureShadow` 0.6 and 1.
const shadows = []
if (process.env.SHADOW_ONLY === '1') {
  // A screenshot that times out is taken once more (a page that is busy is not a result); the file grows as it goes, so a run that
  // stops keeps what it measured (SCENES= picks it up again).
  const again1 = async (url, size) => shoot(url, size).catch(() => shoot(url, size))
  for (const scene of SCENES)
    for (const [view, size, name] of [
      ['diorama', fieldOf(scene, 'diorama'), 'diorama'],
      ['fp', fieldOf(scene, 'fp'), 'fp'],
    ]) {
      if (process.env.VIEWS !== undefined && !process.env.VIEWS.split(',').includes(view)) continue
      const url = `${local()}/?scene=${scene}&view=${view}&pref=webgl&still=1`
      const on = await again1(`${url}${QUERY}`, size)
      const off = await again1(`${url}&shadow=0${QUERY}`, size)
      // SHADOW_FRAMES=1 keeps the two frames, to look at where the shadow's texels are.
      if (process.env.SHADOW_FRAMES === '1') {
        writeFileSync(join(out, `shadow-${scene}-${name}-on.png`), Buffer.from(on.b64, 'base64'))
        writeFileSync(join(out, `shadow-${scene}-${name}-off.png`), Buffer.from(off.b64, 'base64'))
      }
      // The scene itself differs a little between two page loads (a leaf's sway): a third load, with the shadow on again, counts those.
      const again = await again1(`${url}${QUERY}`, size)
      const [a, b, c] = await Promise.all([pixelsOf(on.b64, ...size), pixelsOf(off.b64, ...size), pixelsOf(again.b64, ...size)])
      let noise = 0
      for (let k = 0; k < a.length; k += 4) if (a[k] !== c[k] || a[k + 1] !== c[k + 1] || a[k + 2] !== c[k + 2]) noise++
      let footprint = 0
      let ratio = 0
      for (let k = 0; k < a.length; k += 4) {
        if (a[k] === b[k] && a[k + 1] === b[k + 1] && a[k + 2] === b[k + 2]) continue
        // A texel the scene itself moved between two loads is not the shadow's.
        if (a[k] !== c[k] || a[k + 1] !== c[k + 1] || a[k + 2] !== c[k + 2]) continue
        const [on, off] = [0.2126 * a[k] + 0.7152 * a[k + 1] + 0.0722 * a[k + 2], 0.2126 * b[k] + 0.7152 * b[k + 1] + 0.0722 * b[k + 2]]
        // A shadow only darkens: a texel that is brighter with it on is the scene's own movement that two loads happened to share.
        if (on >= off) continue
        footprint++
        ratio += on / Math.max(1, off)
      }
      shadows.push({ scene, view: name, noise, footprint, darkening: footprint === 0 ? 1 : Math.round((ratio / footprint) * 1000) / 1000 })
      writeFileSync(join(out, 'shadow.json'), `${JSON.stringify(shadows, null, 2)}\n`)
    }
  await browser.close()
  stop()
  process.exit(0)
}

for (const scene of SCENES) {
  for (const view of ['diorama', 'fp']) {
    const panels = [{ title: "EnvironmentBuilder's CPU frame", b64: fileB64(EB_DIR, `${scene}-${view}.png`) }]
    for (const { extra, title } of LIGHTS)
      panels.push({
        title,
        ...(await shoot(`${local()}/?scene=${scene}&view=${view}&pref=webgl${extra}${QUERY}`, fieldOf(scene, view))),
      })
    await write(`${scene}-${view}.png`, panels, fieldOf(scene, view), view === 'fp' ? 2 : 1, { scene, view })
  }
  // The gameplay camera (`af`: 50 mm, 30°, 16 m), and the same camera at the distance the base scene's room view names
  // (`zone`). The page knows these two names; any other falls back to the diorama.
  for (const [view, title] of [
    ['af', '50 mm, 30°, 16 m'],
    ['zone', "the room's view"],
  ]) {
    const panels = []
    for (const { extra, title: light } of LIGHTS)
      panels.push({
        title: `${light} (${title})`,
        ...(await shoot(`${local()}/?scene=${scene}&view=${view}&pref=webgl${extra}${QUERY}`, [320, 180])),
      })
    await write(`${scene}-${view === 'af' ? 'gameplay' : 'zone'}.png`, panels, [320, 180], 2, { scene, view: view === 'af' ? 'gameplay' : 'zone' })
  }
}

// The figures: the builder's base pair at density 2 and its lit sheet, beside the kit's painted figures on main.
const dist = join(repo, 'examples/3d/dist')
if (QUERY === '' && existsSync(join(dist, 'characterkit/painted/index.html'))) {
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
for (const who of QUERY === '' ? ['base-m', 'base-f'] : [])
  await write(
    `figures-fb-${who}.png`,
    [{ title: `FigureBuilder ${who}, 8 views, density 2`, b64: fileB64(FB_DIR, `${who}-turn.png`) }],
    [1024, 192],
    1,
    { view: 'figures' },
  )
if (QUERY === '')
  await write(
    'figures-fb-lit.png',
    [{ title: "FigureBuilder's lit sheet", b64: fileB64(FB_DIR, 'lit/lit-sheet.png') }],
    [858, 1728],
    1,
    { view: 'figures' },
  )

// A run of some scenes keeps the facts of the sheets it did not shoot.
const before = existsSync(join(out, 'shots.json')) && process.env.SCENES !== undefined ? JSON.parse(readFileSync(join(out, 'shots.json'), 'utf8')) : []
const kept = before.filter((f) => f.scene !== undefined && !SCENES.includes(f.scene))
writeFileSync(join(out, 'shots.json'), `${JSON.stringify([...kept, ...facts], null, 2)}\n`)
await browser.close()
stop()
process.exit(0)

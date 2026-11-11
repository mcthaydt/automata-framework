// Spike tll-extensions: the screenshots of the three render extensions' examples (examples/3d), on and off, on WebGL and on
// WebGPU, each a PNG of the game's canvas, plus shots.json (what each drew, and its console errors). Spikes are exempt from
// TDD; nothing here is imported by a package.
//
//   pnpm --filter @af-examples/examples-3d dev                # serves the examples; its URL is BASE
//   BASE=http://localhost:5173 node spikes/tll-extensions/shoot.mjs [out dir]     # default docs/refactor/tll-extensions
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const repo = new URL('../..', import.meta.url).pathname
const require = createRequire(join(repo, 'packages/3d/package.json'))
const { chromium } = require('playwright')

const base = process.env.BASE ?? 'http://localhost:5173'
const out = process.argv[2] ?? join(repo, 'docs/refactor/tll-extensions')
mkdirSync(out, { recursive: true })

// What to shoot: the example's page, the states (a query and keys pressed after the first frame), and the file stem.
const SHOTS = [
  { page: 'lcdpanel/screen', size: [640, 360], states: [['lcd-on', ''], ['lcd-off', '?lcd=0']] },
  { page: 'retrocrisp/grade', size: [640, 360], states: [['retro-on', ''], ['retro-off', '?retro=0'], ['retro-on-crisp-lcd', '?crisp=lcd']] },
  // A 1440 x 810 window: the fractional fit is 2.25 device pixels a pixel (uneven), the whole-pixel scale is 2.
  { page: 'retrocrisp/grade', size: [720, 405], states: [['crisp-whole', '?retro=0'], ['crisp-fit', '?retro=0&scale=fit']] },
  { page: 'roomvisibility/zones', size: [480, 270], states: [
    ['rooms-on-hall', ''], ['rooms-on-corridor', '?zone=corridor'], ['rooms-on-closet', '?zone=closet'], ['rooms-off', '?rooms=0'],
  ] },
]
const only = process.env.ONLY?.split(',')

// Vulkan on SwiftShader is what lets Chromium present a WebGPU canvas here (spikes/eb-look/shoot.mjs).
const browser = await chromium.launch({
  args: ['--enable-unsafe-webgpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader'],
})
const facts = []
for (const { page: path, size, states } of SHOTS)
  for (const [stem, query] of states)
    for (const pref of ['webgl', 'webgpu']) {
      const name = `${stem}-${pref}`
      if (only && !only.some((o) => name.includes(o))) continue
      const page = await browser.newPage({ viewport: { width: size[0] * 2, height: size[1] * 2 }, deviceScaleFactor: 1 })
      const errors = []
      page.on('pageerror', (e) => errors.push(String(e)))
      page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(m.text().slice(0, 300)))
      const url = `${base}/${path}/${query}${query ? '&' : '?'}pref=${pref}`
      await page.goto(url)
      const canvas = page.locator('canvas.af-stage')
      let png = null
      let data = {}
      try {
        await page.getByRole('button', { name: 'Play' }).click({ timeout: 120000 })
        await canvas.waitFor({ state: 'attached', timeout: 120000 })
        // Readiness, not a sleep: let the passes run for a number of frames.
        await page.evaluate(() => new Promise((done) => { let n = 0; const step = () => (++n >= 40 ? done() : requestAnimationFrame(step)); requestAnimationFrame(step) }))
        await page.addStyleTag({ content: '[data-layer="screens"] { visibility: hidden !important }' })
        data = await canvas.evaluate((c) => ({ ...c.dataset }))
        png = await canvas.screenshot({ timeout: 120000 })
      } catch (error) {
        errors.push(`shoot failed: ${String(error).slice(0, 200)}`)
      }
      if (png) writeFileSync(join(out, `${name}.png`), png)
      facts.push({ name, url, drew: data.renderer ?? null, data, errors })
      console.log(name, '->', data.renderer ?? 'failed', JSON.stringify(data), errors.slice(0, 2).join(' | '))
      await page.close()
    }
writeFileSync(join(out, 'shots.json'), `${JSON.stringify(facts, null, 2)}\n`)
await browser.close()

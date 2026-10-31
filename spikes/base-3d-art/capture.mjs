// Renders the spike's moments and feature switches in headless Chromium (SwiftShader) and writes PNGs and costs.
// Usage: node capture.mjs <baseUrl> <outDir> [query ...]
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PW_MODULE ?? 'playwright')
const [base, out, ...queries] = process.argv.slice(2)
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const results = []
for (const query of queries) {
  const q = new URLSearchParams(query)
  const page = await browser.newPage({
    viewport: { width: Number(q.get('w') ?? 844), height: Number(q.get('h') ?? 390) },
  })
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(`${base}?${query}`)
  await page.waitForFunction(
    () => document.documentElement.dataset.ready || document.documentElement.dataset.error,
    null,
    { timeout: 60000 },
  )
  const error = await page.evaluate(() => document.documentElement.dataset.error)
  const name = query.replace(/[=&]/g, '-') || 'default'
  if (!error) await page.screenshot({ path: `${out}/${name}.png` })
  const info = error
    ? { error }
    : await page.evaluate(
        (frames) => {
          const s = window.spike
          return {
            lights: s.lights,
            draws: s.draws,
            renderer: s.renderer,
            bootMs: Math.round(s.bootMs),
            frameMs: Number(s.measure(frames).toFixed(2)),
          }
        },
        Number(q.get('frames') ?? 30),
      )
  results.push({ query, ...info, errors })
  console.log(JSON.stringify(results.at(-1)))
  await page.close()
}
writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2))
await browser.close()

// Day/night probe over a game made by `automata create-game --template 3d` (its node_modules linked from base-3d's):
// node template-day-night.mjs <repo> <gameDir> <outDir> [webgl|webgpu]. Prints mean luminance by day and night and saves both frames.
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const [repo, game, out, backend = 'webgl'] = process.argv.slice(2)
const require = createRequire(join(repo, 'games/base-3d/package.json'))
const { chromium } = require('playwright')
mkdirSync(out, { recursive: true })
const vite = join(game, 'node_modules/vite/bin/vite.js')
const room = join(game, 'content/levels/room.af-sector.json')
const original = readFileSync(room, 'utf8')
async function run(time, port) {
  const file = JSON.parse(original)
  if (time !== 'day') file.time = time
  writeFileSync(room, JSON.stringify(file, null, 2))
  const child = spawn(
    process.execPath,
    [vite, '--configLoader', 'runner', '--strictPort', '--host', 'localhost', '--port', String(port)],
    { cwd: game, stdio: 'ignore' },
  )
  const url = `http://localhost:${port}/?renderer=${backend}`
  for (let i = 0; i < 240; i++) {
    if (
      await fetch(url).then(
        (r) => r.ok,
        () => false,
      )
    )
      break
    await new Promise((r) => setTimeout(r, 250))
  }
  const args =
    backend === 'webgpu'
      ? [
          '--enable-unsafe-webgpu',
          '--use-angle=swiftshader',
          '--enable-unsafe-swiftshader',
          '--enable-features=Vulkan',
          '--use-vulkan=swiftshader',
        ]
      : []
  const browser = await chromium.launch({ args })
  try {
    const play = await browser.newPage({ viewport: { width: 1194, height: 834 } })
    play.on('console', (m) => {
      if (m.type() === 'error') console.error(time, m.text().slice(0, 300))
    })
    await play.goto(url)
    // A new game may open on a Language dialog first.
    const playButton = play.getByRole('button', { name: 'Play' })
    await playButton.or(play.getByRole('dialog')).first().waitFor({ timeout: 90000 })
    if (!(await playButton.isVisible())) {
      await play.getByRole('dialog').getByRole('button').first().click()
    }
    await playButton.click()
    await play.locator('canvas').first().waitFor()
    await play.waitForTimeout(5000)
    const shot = await play.locator('canvas').first().screenshot()
    writeFileSync(join(out, `tpl-${time}-${backend}${process.env.TAG ?? ''}.png`), shot)
    return await play.evaluate(async (data) => {
      const im = new Image()
      im.src = `data:image/png;base64,${data}`
      await im.decode()
      const c = document.createElement('canvas')
      c.width = im.width
      c.height = im.height
      const x = c.getContext('2d')
      x.drawImage(im, 0, 0)
      const p = x.getImageData(0, 0, c.width, c.height).data
      let s = 0
      for (let i = 0; i < p.length; i += 4) s += 0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2]
      return s / (p.length / 4) / 255
    }, shot.toString('base64'))
  } finally {
    await browser.close()
    child.kill('SIGTERM')
    writeFileSync(room, original)
  }
}
const day = await run('day', 6811)
const night = await run('night', 6812)
console.log(
  JSON.stringify({
    backend,
    day: +day.toFixed(3),
    night: +night.toFixed(3),
    ratio: +(night / day).toFixed(2),
  }),
)
process.exit(0)

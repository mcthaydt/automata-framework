// Day/night probe over base-3d, as the editor's night journey plays it (a copy of its content, the level's time set):
// node base-3d-day-night.mjs <repo> <outDir> [webgl|webgpu]. VIEW_DISTANCE=<m> overrides every view's distance; TAG names
// the frames. Prints mean luminance by day and night and saves both frames.
import { spawn } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [repo, out, backend = 'webgl'] = process.argv.slice(2)
const require = createRequire(join(repo, 'games/base-3d/package.json'))
const { chromium } = require('playwright')
mkdirSync(out, { recursive: true })
const game = join(repo, 'games/base-3d')
const vite = join(repo, 'games/base-3d/node_modules/vite/bin/vite.js')
async function run(time, port) {
  const copy = mkdtempSync(join(tmpdir(), 'probe-'))
  cpSync(join(game, 'content'), join(copy, 'content'), { recursive: true })
  const room = join(copy, 'content/levels/room.af-sector.json')
  const file = JSON.parse(readFileSync(room, 'utf8'))
  if (time === 'day') delete file.time
  else file.time = time
  if (process.env.VIEW_DISTANCE)
    for (const v of Object.values(file.views)) v.distance = Number(process.env.VIEW_DISTANCE)
  writeFileSync(room, JSON.stringify(file, null, 2))
  const child = spawn(
    process.execPath,
    [vite, '--configLoader', 'runner', '--strictPort', '--host', 'localhost', '--port', String(port)],
    {
      cwd: game,
      env: { ...process.env, AF_E2E_CONTENT_ROOT: copy, VITE_AF_JOURNEYS: '1' },
      stdio: 'ignore',
    },
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
      if (m.type() === 'error' || m.type() === 'warning') console.error(time, m.text().slice(0, 200))
    })
    await play.goto(url)
    const title = play.getByText('Press any key or tap'),
      newGame = play.getByRole('button', { name: 'New game' }),
      playing = play.getByRole('button', { name: 'Pause' })
    await title.or(newGame).or(playing).first().waitFor({ timeout: 60000 })
    if (await title.isVisible()) await play.keyboard.press('Enter')
    await newGame.or(playing).first().waitFor()
    if (await newGame.isVisible()) await newGame.click()
    await playing.waitFor()
    await play.waitForTimeout(4000)
    const shot = await play.locator('canvas').first().screenshot()
    writeFileSync(join(out, `${time}-${backend}${process.env.TAG ?? ''}.png`), shot)
    const lum = await play.evaluate(async (data) => {
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
    return lum
  } finally {
    await browser.close()
    child.kill('SIGTERM')
  }
}
const day = await run('day', 6801)
const night = await run('night', 6802)
console.log(
  JSON.stringify({
    backend,
    day: +day.toFixed(3),
    night: +night.toFixed(3),
    ratio: +(night / day).toFixed(2),
  }),
)
process.exit(0)

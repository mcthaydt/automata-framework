// Takes every picture on the site (src/shared/pictures.ts) from the built site, so a picture is a product of the build
// and not a file somebody once dragged in. The same build gives the same pictures: each page runs on a fake clock
// (Playwright's `page.clock`) that is installed before the page loads and moved in fixed steps, so an animation is
// always on the same frame.
//   node scripts/take-pictures.ts <build-directory>
// Then run scripts/encode-previews.ts for the WebP copies.
import { type ChildProcess, spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium, type Page } from '@playwright/test'
import { browserSafePort } from '../../packages/tools/src/shared/ship/ports/browser-safe-port.ts'
import { portsFor } from '../../packages/tools/src/shared/ship/ports/ports-for.ts'
import { PICTURES, type Picture } from '../src/shared/pictures.ts'

const STEP_MS = 100
const buildDirectory = resolve(process.argv[2] ?? 'build')
const outDirectory = resolve('static/previews')
const port = browserSafePort(portsFor(process.cwd(), process.env).preview + 80)
const origin = `http://127.0.0.1:${port}`

/** Moves the page's clock on by `ms` in fixed steps, with a real beat after each so timers and frames settle. */
async function run(page: Page, ms: number): Promise<void> {
  for (let elapsed = 0; elapsed < ms; elapsed += STEP_MS) {
    await page.clock.runFor(STEP_MS)
    await page.waitForTimeout(20)
  }
}

/**
 * A game's demo page: Play, then walk right and jump, so the picture is the game being played and not its title. The
 * game's own pause button is hidden because it is page chrome and not part of the game's picture.
 */
async function takeGame(page: Page, picture: Picture): Promise<Buffer> {
  // Real time here: the game loads its files as fast as the machine does, and the clock must not move while it does.
  const play = page.getByRole('button', { name: 'Play', exact: true })
  await play.waitFor()
  await page.waitForTimeout(500)
  await play.click()
  // The level's art loads after Play too; the frames the clock then runs must all find it loaded.
  await page.waitForTimeout(1500)
  await page.addStyleTag({ content: 'button { visibility: hidden !important }' })
  await run(page, 500)
  await page.keyboard.down('ArrowRight')
  await run(page, picture.ms - 1000)
  await page.keyboard.down('Space')
  await run(page, 300)
  return page.screenshot({ type: 'jpeg', quality: 90 })
}

/**
 * The try-it editor on a new platformer: New level, Platformer, then a few coins and a slime so the room reads as a
 * level and not a floor. Every click is on a named control; the canvas points are fractions of its box.
 */
async function takeEditor(page: Page, picture: Picture): Promise<Buffer> {
  await run(page, picture.ms)
  await page.getByRole('button', { name: 'New level' }).click()
  await run(page, 200)
  // The "New level" picture is the choice itself, before one is made.
  if (picture.name === 'editor-new') return shot(page, picture)
  await page.getByRole('button', { name: /Platformer/ }).click()
  for (let waited = 0; waited < 3000; waited += STEP_MS) {
    await run(page, STEP_MS)
    if ((await page.locator('[data-level-canvas]').getAttribute('data-state')) === 'drawn') break
  }
  await place(page)
  await run(page, 500)
  return shot(page, picture)
}

/**
 * An example on its playground page: the page starts it (or waits for Play where the visitor asked for less motion), the
 * clock runs for the picture's time, and the picture is the game in its preview and nothing around it.
 */
async function takeExample(page: Page, picture: Picture): Promise<Buffer> {
  const playground = page.locator('.playground')
  await playground.waitFor()
  const play = page.getByRole('button', { name: /^Play$/ })
  if (await play.isVisible().catch(() => false)) await play.click()
  // Real time: the frame loads its module as fast as the machine does, and the clock must not move while it does.
  await page.waitForFunction(
    () => document.querySelector('.playground')?.getAttribute('data-preview') === 'running',
    undefined,
    {
      timeout: 20_000,
    },
  )
  await run(page, picture.ms)
  await page.mouse.move(0, 0)
  // The game alone: the frame's own pause button is hidden (it is chrome, not part of the game), and the picture is cut
  // to the black field the game plays in, found by scanning a first picture of the frame, because the frame letterboxes
  // the game inside its own colours and that border is not what an example looks like.
  const frame = page.frames().find((each) => each.url().includes('/playground/examples/'))
  if (frame === undefined) throw new Error(`${picture.name} has no example frame`)
  await frame.addStyleTag({ content: 'button { visibility: hidden !important }' })
  const canvas = page.locator('.playground-preview iframe.shown')
  const box = await canvas.boundingBox()
  if (box === null) throw new Error(`${picture.name} shows no frame`)
  const first = (await canvas.screenshot({ type: 'png' })).toString('base64')
  // On a blank page of its own: the site's pages allow no data: addresses.
  const scanner = await page.context().newPage()
  const field = await scanner.evaluate(async (data) => {
    const image = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob())
    const surface = new OffscreenCanvas(image.width, image.height)
    const context = surface.getContext('2d')!
    context.drawImage(image, 0, 0)
    const { data: pixels } = context.getImageData(0, 0, image.width, image.height)
    const black = (x: number, y: number): boolean => {
      const at = (y * image.width + x) * 4
      return pixels[at]! + pixels[at + 1]! + pixels[at + 2]! < 12
    }
    // A row or column belongs to the field when most of it is black; the border's colours are never black.
    const dense = (length: number, other: number, at: (i: number, j: number) => boolean): number[] =>
      Array.from({ length }, (_, i) => i).filter((i) => {
        let count = 0
        for (let j = 0; j < other; j++) if (at(i, j)) count++
        return count > other * 0.4
      })
    const rows = dense(image.height, image.width, (y, x) => black(x, y))
    const columns = dense(image.width, image.height, (x, y) => black(x, y))
    return {
      top: rows[0]!,
      bottom: rows[rows.length - 1]!,
      left: columns[0]!,
      right: columns[columns.length - 1]!,
    }
  }, first)
  await scanner.close()
  const scale = (await page.evaluate(() => devicePixelRatio)) || 1
  return page.screenshot({
    type: 'jpeg',
    quality: 90,
    clip: {
      x: box.x + field.left / scale,
      y: box.y + field.top / scale,
      width: (field.right - field.left + 1) / scale,
      height: (field.bottom - field.top + 1) / scale,
    },
  })
}

/** A pointer left over the canvas would show a hover ring in the picture. */
async function shot(page: Page, picture: Picture): Promise<Buffer> {
  await page.mouse.move(0, 0)
  const cut = picture.cut
  return page.screenshot({
    type: 'jpeg',
    quality: 90,
    ...(cut === undefined
      ? {}
      : { clip: { x: cut.x, y: cut.y, width: picture.width, height: picture.height } }),
  })
}

const PLACEMENTS: readonly { readonly what: string; readonly at: readonly [number, number][] }[] = [
  {
    what: 'coin',
    at: [
      [0.3, 0.55],
      [0.4, 0.45],
      [0.5, 0.55],
    ],
  },
  { what: 'slime', at: [[0.7, 0.67]] },
]

async function place(page: Page): Promise<void> {
  const box = await page.locator('[data-level-canvas]').boundingBox()
  if (box === null) throw new Error('The editor shows no level to place on')
  for (const { what, at } of PLACEMENTS) {
    await page.locator(`[data-choice="entity-${what}"]`).click()
    for (const [x, y] of at) await page.mouse.click(box.x + box.width * x, box.y + box.height * y)
  }
}

function startServer(): ChildProcess {
  return spawn('node', ['scripts/serve-static.ts', buildDirectory, String(port)], { stdio: 'ignore' })
}

async function waitForServer(): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      if ((await fetch(origin + '/')).status < 500) return
    } catch {
      // not up yet
    }
    await new Promise((done) => setTimeout(done, 100))
  }
  throw new Error(`The server did not start on ${origin}`)
}

mkdirSync(outDirectory, { recursive: true })
const server = startServer()
try {
  await waitForServer()
  const browser = await chromium.launch()
  const only = process.argv[3]
  for (const picture of PICTURES.filter((each) => only === undefined || each.name.startsWith(only))) {
    const context = await browser.newContext({
      viewport: picture.cut?.window ?? { width: picture.width, height: picture.height },
      deviceScaleFactor: picture.target === 'example' ? 2 : 1,
      reducedMotion: 'no-preference',
    })
    const page = await context.newPage()
    await page.clock.install({ time: 0 })
    await page.goto(origin + picture.url)
    const image =
      picture.target === 'game'
        ? await takeGame(page, picture)
        : picture.target === 'example'
          ? await takeExample(page, picture)
          : await takeEditor(page, picture)
    writeFileSync(join(outDirectory, `${picture.name}.jpg`), image)
    console.log('took', picture.name)
    await context.close()
  }
  await browser.close()
} finally {
  server.kill()
}

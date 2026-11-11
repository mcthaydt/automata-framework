// The visual gates of cycle c7: renders and measurements, made by this script and never by hand.
//
//   pnpm --filter @automata/character-kit gate 1       gate 1: characterkit-painted before and after, texels a pixel, the
//                                                      depth sheet (docs/refactor/c7/gate-1/)
//   pnpm --filter @automata/character-kit gate runway  gate 2: the runway's stills, loop frames and timings (gate-2/)
//
// Gate 1's "before" is the commit this branch was cut from (BASE, the head of the figure-builder submodule branch), built in a
// worktree of its own (`git worktree add`, then `pnpm install`: the builder's declarations are built at install and are
// git-ignored). Both sides run in Chromium under Playwright's fake clock and `reducedMotion: 'reduce'` (which zeroes the camera's
// damping), so the same tick is the same frame. Numbers come from the pictures and the builder, never typed.
import { spawnSync } from 'node:child_process'
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join } from 'node:path'
import { type Browser, chromium, type Page } from 'playwright'
import { BASE as FIGURES, member, standing } from '../src/shared/figure-builder/door.ts'

const KIT = join(import.meta.dirname, '..')
const REPO = join(KIT, '../..')
/** The head of `claude/figurebuilder-submodule`, which this branch was cut from. */
const BASE_COMMIT = 'a66b4e0e'
const PAINTED = '/characterkit/painted/'
/** Fake-clock milliseconds the sim runs after its first drawn frame: 2 ticks, the walker a metre to the stander's left, behind the wall, the two figures apart. */
const RUN_MS = 33
const SCALE = 4

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
}

/** Serves a built folder on a free port, with `/index.html` for a folder; returns the origin and a close. */
async function serve(dir: string): Promise<{ origin: string; close(): void }> {
  const server = createServer((request, response) => {
    let path = join(dir, decodeURIComponent((request.url ?? '/').split('?')[0] ?? '/'))
    if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html')
    if (!existsSync(path)) {
      response.writeHead(404).end()
      return
    }
    response.writeHead(200, { 'content-type': MIME[extname(path)] ?? 'application/octet-stream' })
    createReadStream(path).pipe(response)
  })
  await new Promise<void>((resolve) => server.listen(0, 'localhost', resolve))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  return { origin: `http://localhost:${port}`, close: () => server.close() }
}

/** Builds the examples of the working tree at `root`. */
function build(root: string): string {
  const cwd = join(root, 'examples/3d')
  const done = spawnSync('pnpm', ['exec', 'vite', 'build'], { cwd, stdio: ['ignore', 'ignore', 'inherit'] })
  if (done.status !== 0) throw new Error(`the build in ${cwd} failed`)
  return join(cwd, 'dist')
}

/** The base's working tree, made once (a git worktree with its own install). */
function baseTree(): string {
  const dir = join(REPO, '../c7-base')
  if (!existsSync(join(dir, 'node_modules'))) {
    throw new Error(
      `The base tree is missing: git worktree add --detach ${dir} ${BASE_COMMIT}, put vendor/FigureBuilder at the commit its gitlink names, and pnpm install there.`,
    )
  }
  return dir
}

interface Frame {
  readonly width: number
  readonly height: number
  readonly rgba: Uint8ClampedArray
}

/** Plays an example under the fake clock for `ms` and reads the game canvas back right after a frame. */
async function capture(
  browser: Browser,
  url: string,
  ms: number,
  field: readonly [number, number],
): Promise<Frame> {
  // The viewport is the field's own size, so the letterbox's upscale is ×1 and the canvas holds the field's pixels.
  const context = await browser.newContext({
    viewport: { width: field[0], height: field[1] },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  await page.clock.install({ time: 0 })
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(url)
  const play = page.getByTestId('play')
  await play.waitFor({ timeout: 60_000 })
  // Paused before Play, so the sim starts on a clock that only this script moves.
  const now = await page.evaluate(() => Date.now())
  await page.clock.pauseAt(now + 100)
  await play.click()
  // The renderer starts on real asynchronous work (WebGL, assets) that the fake clock does not drive, so the sim's first tick is
  // not at a fixed fake time. Step frame by frame until the canvas shows the figures, and count the run from there.
  const read = (all: boolean) =>
    page.evaluate(
      (all) =>
        new Promise<{ width: number; height: number; data: number[]; drawn: boolean }>((resolve) => {
          requestAnimationFrame(() => {
            const canvas = document.querySelector<HTMLCanvasElement>('canvas.af-stage')
            const copy = document.createElement('canvas')
            const draw = copy.getContext('2d')
            if (canvas === null || draw === null) throw new Error('no game canvas')
            copy.width = canvas.width
            copy.height = canvas.height
            draw.drawImage(canvas, 0, 0)
            const pixels = draw.getImageData(0, 0, copy.width, copy.height).data
            // Drawn once the figures are in: the scene alone is a handful of flat colours, a painted figure is dozens.
            const colours = new Set<number>()
            for (let i = 0; i < pixels.length && colours.size < 15; i += 4)
              colours.add(((pixels[i] ?? 0) << 16) | ((pixels[i + 1] ?? 0) << 8) | (pixels[i + 2] ?? 0))
            const drawn = colours.size >= 15
            resolve({ width: copy.width, height: copy.height, data: all ? Array.from(pixels) : [], drawn })
          })
        }),
      all,
    )
  let first = false
  for (let step = 0; step < 600 && !first; step++) {
    const reading = read(false)
    await page.clock.runFor(17)
    first = (await reading).drawn
    if (!first) await page.waitForTimeout(20)
  }
  if (!first) throw new Error(`${url}: the game drew nothing`)
  await page.clock.runFor(ms)
  // The canvas keeps no drawing buffer past the frame, so a read is kept only when it caught a drawn one.
  let caught: { width: number; height: number; data: number[]; drawn: boolean } | undefined
  for (let attempt = 0; attempt < 10 && !caught?.drawn; attempt++) {
    const reading = read(true)
    await page.clock.runFor(17)
    caught = await reading
  }
  if (!caught?.drawn) throw new Error(`${url}: no drawn frame could be read`)
  const { width, height, data } = caught
  await context.close()
  if (errors.length > 0) throw new Error(`page errors in ${url}: ${errors.join('; ')}`)
  return { width, height, rgba: new Uint8ClampedArray(data) }
}

/** PNG bytes of frames laid side by side (8 px apart, on grey), each scaled up by whole pixels (nearest), encoded by the page. */
async function png(page: Page, frames: readonly Frame[], scale: number): Promise<Buffer> {
  const url = await page.evaluate(
    ({ tiles, scale }) => {
      const gap = 8
      const width = tiles.reduce((sum, t) => sum + t.width * scale + gap, gap)
      const height = Math.max(...tiles.map((t) => t.height)) * scale + 2 * gap
      const out = document.createElement('canvas')
      out.width = width
      out.height = height
      const draw = out.getContext('2d')
      if (draw === null) throw new Error('no 2d context')
      draw.fillStyle = '#808080'
      draw.fillRect(0, 0, width, height)
      draw.imageSmoothingEnabled = false
      let x = gap
      for (const t of tiles) {
        const source = document.createElement('canvas')
        source.width = t.width
        source.height = t.height
        source
          .getContext('2d')
          ?.putImageData(new ImageData(new Uint8ClampedArray(t.data), t.width, t.height), 0, 0)
        draw.drawImage(source, x, gap, t.width * scale, t.height * scale)
        x += t.width * scale + gap
      }
      return out.toDataURL('image/png')
    },
    { tiles: frames.map((f) => ({ width: f.width, height: f.height, data: Array.from(f.rgba) })), scale },
  )
  return Buffer.from(url.split(',')[1] ?? '', 'base64')
}

interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
  size: number
}

/** The figures in a render: what is left when the scene's flat colours (the floor, the room, the wall) are taken
 * away, as connected regions (8-way) of at least 300 pixels. */
function figuresIn({ width, height, rgba }: Frame): Box[] {
  const key = (i: number) =>
    ((rgba[i * 4] ?? 0) >> 3) * 1024 + ((rgba[i * 4 + 1] ?? 0) >> 3) * 32 + ((rgba[i * 4 + 2] ?? 0) >> 3)
  const counts = new Map<number, number>()
  for (let i = 0; i < width * height; i++) counts.set(key(i), (counts.get(key(i)) ?? 0) + 1)
  const scene = new Set([...counts].filter(([, n]) => n > width * height * 0.01).map(([k]) => k))
  // A colour that runs 60 pixels along a row is the scene's too (the wall's lit top edge): no figure has a stripe that wide.
  for (let y = 0; y < height; y++) {
    let run = 1
    for (let x = 1; x < width; x++) {
      run = key(y * width + x) === key(y * width + x - 1) ? run + 1 : 1
      if (run >= 60) scene.add(key(y * width + x))
    }
  }
  const mask = new Uint8Array(width * height)
  for (let i = 0; i < width * height; i++) mask[i] = scene.has(key(i)) ? 0 : 1
  const boxes: Box[] = []
  for (let start = 0; start < mask.length; start++) {
    if (mask[start] !== 1) continue
    const box = { x0: width, y0: height, x1: 0, y1: 0, size: 0 }
    const stack = [start]
    mask[start] = 2
    while (stack.length > 0) {
      const at = stack.pop() as number
      const x = at % width
      const y = Math.floor(at / width)
      box.x0 = Math.min(box.x0, x)
      box.x1 = Math.max(box.x1, x)
      box.y0 = Math.min(box.y0, y)
      box.y1 = Math.max(box.y1, y)
      box.size++
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height || mask[ny * width + nx] !== 1) continue
          mask[ny * width + nx] = 2
          stack.push(ny * width + nx)
        }
      }
    }
    if (box.size >= 300) boxes.push(box)
  }
  return boxes
}

const crop = ({ width, rgba }: Frame, b: Box, pad: number): Frame => {
  const [x0, y0] = [Math.max(0, b.x0 - pad), Math.max(0, b.y0 - pad)]
  const [w, h] = [b.x1 - b.x0 + 1 + 2 * pad, b.y1 - b.y0 + 1 + 2 * pad]
  const out = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      out.set(
        rgba.subarray(((y0 + y) * width + x0 + x) * 4, ((y0 + y) * width + x0 + x) * 4 + 4),
        (y * w + x) * 4,
      )
  return { width: w, height: h, rgba: out }
}

/** The painted rows of the builder's own cell, and its frame. */
function cellRows(cell: Uint8ClampedArray, width: number): { rows: number; frame: Frame } {
  const height = cell.length / 4 / width
  let [first, last] = [height, -1]
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((cell[(y * width + x) * 4 + 3] ?? 0) > 0) {
        first = Math.min(first, y)
        last = y
      }
    }
  }
  return { rows: last - first + 1, frame: { width, height, rgba: cell } }
}

/** Of the stander's opaque texels, how many a render holds exactly one pixel each at the best offset near `box` (1 when the cell
 * is on the screen as the builder painted it). */
function exactShare(render: Frame, cell: Frame, box: Box): number {
  let best = 0
  let opaque = 0
  for (let i = 3; i < cell.rgba.length; i += 4) if ((cell.rgba[i] ?? 0) > 0) opaque++
  // Where the cell's top-left would be if its painted texels began at the figure's box, and a few pixels either way.
  let [col, row] = [cell.width, cell.height]
  for (let i = 0; i < cell.rgba.length / 4; i++) {
    if ((cell.rgba[i * 4 + 3] ?? 0) === 0) continue
    col = Math.min(col, i % cell.width)
    row = Math.min(row, Math.floor(i / cell.width))
  }
  for (let oy = box.y0 - row - 3; oy <= box.y0 - row + 3; oy++) {
    for (let ox = box.x0 - col - 3; ox <= box.x0 - col + 3; ox++) {
      let same = 0
      for (let y = 0; y < cell.height; y++) {
        for (let x = 0; x < cell.width; x++) {
          const t = (y * cell.width + x) * 4
          if ((cell.rgba[t + 3] ?? 0) === 0) continue
          const px = ox + x
          const py = oy + y
          if (px < 0 || py < 0 || px >= render.width || py >= render.height) continue
          const p = (py * render.width + px) * 4
          if (
            cell.rgba[t] === render.rgba[p] &&
            cell.rgba[t + 1] === render.rgba[p + 1] &&
            cell.rgba[t + 2] === render.rgba[p + 2]
          )
            same++
        }
      }
      best = Math.max(best, same)
    }
  }
  return best / opaque
}

async function gateOne(): Promise<void> {
  const out = join(REPO, 'docs/refactor/c7/gate-1')
  mkdirSync(out, { recursive: true })
  const browser = await chromium.launch()
  const scratch = await (await browser.newContext()).newPage()
  // The stander is the woman, facing +x; the follow camera looks toward +z (from the −z side), so she is seen at the builder's direction 6 (three quarters of a turn).
  const woman = FIGURES[1]?.def
  if (!woman) throw new Error('no second base figure')
  const measured: Record<string, unknown> = {
    baseCommit: BASE_COMMIT,
    runMs: RUN_MS,
    clock: 'fake, reducedMotion: reduce',
    stander: woman.id,
  }
  const crops: Frame[] = []
  const rendered: Record<string, Frame> = {}
  for (const [name, root, field, pitch] of [
    ['before', baseTree(), [480, 270], (25 * Math.PI) / 180],
    ['after', REPO, [720, 405], undefined],
  ] as const) {
    const site = await serve(build(root))
    const frame = await capture(browser, `${site.origin}${PAINTED}`, RUN_MS, field)
    site.close()
    rendered[name] = frame
    writeFileSync(join(out, `${name}.png`), await png(scratch, [frame], SCALE))
    // The figure the render holds that is farthest from the middle of the field is the stander (the camera follows the walker).
    const boxes = figuresIn(frame).sort(
      (a, b) => Math.abs((a.x0 + a.x1) / 2 - frame.width / 2) - Math.abs((b.x0 + b.x1) / 2 - frame.width / 2),
    )
    const stander = boxes.at(-1)
    if (boxes.length < 2 || !stander)
      throw new Error(
        `${name}: expected two figures in the render, found ${boxes.length} ${JSON.stringify(boxes)}`,
      )
    const cast = member(woman, 2)
    const { rows, frame: cell } = cellRows(standing(cast, 6, pitch), cast.cell[0])
    const heightPx = stander.y1 - stander.y0 + 1
    measured[name] = {
      field: [frame.width, frame.height],
      figuresFound: boxes.length,
      standerBox: stander,
      standerHeightPx: heightPx,
      cellPaintedRows: rows,
      cellPitchDeg: pitch === undefined ? 18 : (pitch * 180) / Math.PI,
      texelsPerPixel: rows / heightPx,
      ...(name === 'after' ? { exactTexelShare: exactShare(frame, cell, stander) } : {}),
    }
    crops.push(crop(frame, stander, 6))
    if (name === 'after') crops.push(cell)
  }
  const [before, after, cell] = crops
  writeFileSync(
    join(out, 'stander-before-after-builder.png'),
    await png(scratch, [before as Frame, after as Frame, cell as Frame], SCALE),
  )
  writeFileSync(join(out, 'measurements.json'), `${JSON.stringify(measured, null, 2)}\n`)
  console.log(JSON.stringify(measured, null, 2))
  await browser.close()
  // The depth sheet and the parity counts come from the kit's own browser project, on the same GPU path the tests use.
  const sheets = spawnSync(
    'pnpm',
    [
      'exec',
      'vitest',
      'run',
      '--project',
      'browser',
      '--browser.name=chromium',
      'tests/browser/painted/gate-sheets.test.ts',
    ],
    {
      cwd: KIT,
      stdio: 'inherit',
      env: { ...process.env, VITE_C7_GATE: '1', C7_GATE_OUT: out },
    },
  )
  if (sheets.status !== 0) throw new Error('the depth sheet failed')
}

const which = process.argv[2] ?? '1'
if (which === '1') await gateOne()
else throw new Error(`unknown gate ${which}`)

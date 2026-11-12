// The visual gates of cycle c7: renders and measurements, made by this script and never by hand.
//
//   pnpm --filter @automata/character-kit gate 1       gate 1: characterkit-painted before and after, texels a pixel, the
//                                                      depth sheet (docs/refactor/c7/gate-1/)
//   pnpm --filter @automata/character-kit gate lit    the c8 gate: the base pair lit by the room, before and after, on WebGL
//                                                      and WebGPU, the bench and the parity counts (docs/refactor/c8/gate-lit/)
//   (gate 2, the runway's stills, loop frames and timings, is written with Task 10 of the plan, which is on hold: `gate runway`
//   does not exist yet and asking for it throws)
//
// Gate 1's "before" is the commit this branch was cut from (BASE, the last commit before the painter joined this repository), built in a
// worktree of its own (`git worktree add`, then `pnpm install`: the builder's declarations are built at install and are
// git-ignored). Both sides run in Chromium under Playwright's fake clock and `reducedMotion: 'reduce'` (which zeroes the camera's
// damping), so the same tick is the same frame. Numbers come from the pictures and the builder, never typed.
import { spawnSync } from 'node:child_process'
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:http'
import { extname, join } from 'node:path'
import { type Browser, chromium, type Page } from 'playwright'
import {
  type CastMember,
  cellOf,
  BASE as FIGURES,
  Figure,
  member,
  standing,
} from '../src/shared/figures/door.ts'

const KIT = join(import.meta.dirname, '..')
const REPO = join(KIT, '../..')
/** The last commit before the painter joined this repository, which this branch was cut from. */
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
      `The base tree is missing: git worktree add --detach ${dir} ${BASE_COMMIT}, give the figure builder's folder there the commit that tree names, and pnpm install there.`,
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

/** The painted rows of the builder's own cell, the first of them, and its frame. */
function cellRows(cell: Uint8ClampedArray, width: number): { rows: number; first: number; frame: Frame } {
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
  return { rows: last - first + 1, first, frame: { width, height, rgba: cell } }
}

/** How a render holds a cell the builder painted: the offset at which most of its opaque texels sit equal, one pixel each. */
interface Match {
  /** Opaque texels of the cell equal to the render's pixel under them, over all its opaque texels. */
  share: number
  same: number
  opaque: number
  /** Where the cell's top-left is in the render. */
  ox: number
  oy: number
}

/** The best offset for `cell` in `render` within `reach` pixels of `centre` (where the cell's painted texels would begin at the
 * figure's `box`, when no centre is given). */
function matchCell(
  render: Frame,
  cell: Frame,
  box: Box,
  centre?: readonly [number, number],
  reach = 3,
): Match {
  let opaque = 0
  for (let i = 3; i < cell.rgba.length; i += 4) if ((cell.rgba[i] ?? 0) > 0) opaque++
  let [cx, cy] = centre ?? [0, 0]
  if (centre === undefined) {
    let [col, row] = [cell.width, cell.height]
    for (let i = 0; i < cell.rgba.length / 4; i++) {
      if ((cell.rgba[i * 4 + 3] ?? 0) === 0) continue
      col = Math.min(col, i % cell.width)
      row = Math.min(row, Math.floor(i / cell.width))
    }
    ;[cx, cy] = [box.x0 - col, box.y0 - row]
  }
  let best: Match = { share: 0, same: 0, opaque, ox: cx, oy: cy }
  for (let oy = cy - reach; oy <= cy + reach; oy++) {
    for (let ox = cx - reach; ox <= cx + reach; ox++) {
      const same = countSame(render, cell, ox, oy, 0, cell.height)
      if (same > best.same) best = { share: same / opaque, same, opaque, ox, oy }
    }
  }
  return best
}

/** Opaque texels of `cell` in rows `from` to `to` (exclusive) that equal the render's pixel under them at offset (`ox`, `oy`). */
function countSame(render: Frame, cell: Frame, ox: number, oy: number, from: number, to: number): number {
  let same = 0
  for (let y = from; y < to; y++) {
    for (let x = 0; x < cell.width; x++) {
      const t = (y * cell.width + x) * 4
      if ((cell.rgba[t + 3] ?? 0) === 0) continue
      const [px, py] = [ox + x, oy + y]
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
  return same
}

/** Idle steps tried: 10 s at the builder's own 1/60 s step, longer than any idle cycle shows a new pose in. */
const IDLE_STEPS = 600

/** The stander is the builder's `Figure` standing idle on the page's frame clock, and which idle step the first drawn frame
 * lands on depends on how many 17 ms fake-clock steps the page took to start. So the render is compared with the builder's own
 * idle cells, step by step, and the best is the one drawn for that frame: like for like, whatever the step. */
function bestIdle(
  cast: CastMember,
  direction: number,
  render: Frame,
  box: Box,
): { step: number; stepsAtBest: number; match: Match; cell: Frame; anchorY: number } {
  const figure = new Figure(cast)
  const view = { azimuth: 0, pitch: (18 * Math.PI) / 180 }
  let best: { step: number; stepsAtBest: number; match: Match; cell: Frame; anchorY: number } | undefined
  let centre: [number, number] | undefined
  for (let step = 1; step <= IDLE_STEPS; step++) {
    figure.update(1 / 60, { facing: (direction * Math.PI) / 4, moving: false, view })
    const cell: Frame = { width: cast.cell[0], height: cast.cell[1], rgba: figure.painted.slice() }
    // The first step finds the offset (a few pixels either way); the rest only look a pixel around it.
    const match = matchCell(render, cell, box, centre, centre === undefined ? 3 : 1)
    centre ??= [match.ox, match.oy]
    if (best === undefined || match.share > best.match.share)
      best = { step, stepsAtBest: 1, match, cell, anchorY: cellOf(figure).anchor[1] }
    else if (match.share === best.match.share) best.stepsAtBest++
  }
  return best as NonNullable<typeof best>
}

/** The match of the stander's frame, read as the builder's contract has it: the ground is the cell's anchor row, and the room's
 * floor (its top at the ground, nearer the camera than the soles' outline, which hangs a few centimetres below it) hides what is
 * under it. Those texels are counted on their own line, and the texels a pixel are measured from the ground up, so the floor
 * does not shorten the figure. */
function groundReport(
  render: Frame,
  idle: ReturnType<typeof bestIdle>,
  box: Box,
  sheet: Match,
): Record<string, unknown> {
  const { cell, match, anchorY } = idle
  // A texel row is under the ground when its middle is below the anchor.
  const firstBelow = Math.floor(anchorY - 0.5) + 1
  const { rows: paintedRows, first: firstPainted } = cellRows(cell.rgba, cell.width)
  let belowOpaque = 0
  for (let y = firstBelow; y < cell.height; y++)
    for (let x = 0; x < cell.width; x++) if ((cell.rgba[(y * cell.width + x) * 4 + 3] ?? 0) > 0) belowOpaque++
  const belowSame = countSame(render, cell, match.ox, match.oy, firstBelow, cell.height)
  const aboveOpaque = match.opaque - belowOpaque
  const aboveSame = match.same - belowSame
  const rowsAbove = firstBelow - firstPainted
  const pixelsAbove = match.oy + firstBelow - box.y0
  return {
    cellPaintedRows: paintedRows,
    cellPitchDeg: 18,
    // The whole figure, soles and all, the way the before side is measured.
    texelsPerPixel: paintedRows / (box.y1 - box.y0 + 1),
    // From the ground up: what the floor does not touch.
    groundRow: anchorY,
    cellRowsAboveGround: rowsAbove,
    standerHeightAboveGroundPx: pixelsAbove,
    texelsPerPixelAboveGround: rowsAbove / pixelsAbove,
    // The builder's own idle cell this frame shows: the first step (of the builder's 1/60 s steps from standing still) that reaches
    // the best share, and how many steps reach it (the idle moves slowly: a cell often holds for a few steps).
    matchedIdleStep: idle.step,
    matchedIdleSeconds: idle.step / 60,
    idleStepsAtBest: idle.stepsAtBest,
    opaqueTexels: match.opaque,
    exactTexels: match.same,
    exactTexelShare: match.share,
    exactTexelShareAboveGround: aboveSame / aboveOpaque,
    opaqueTexelsBelowGround: belowOpaque,
    belowGroundTexelsSeen: belowSame,
    belowGroundTexelsHiddenByFloor: belowOpaque - belowSame,
    // For the record: the builder's `standing` cell (the idle's third step), the number the plan's log first gave.
    exactTexelShareVsStanding: sheet.share,
  }
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
    const heightPx = stander.y1 - stander.y0 + 1
    const whole = {
      field: [frame.width, frame.height],
      figuresFound: boxes.length,
      standerBox: stander,
      standerHeightPx: heightPx,
    }
    crops.push(crop(frame, stander, 6))
    if (name === 'before') {
      // Whole figure, soles and all: the base tree has no floor to hide them, and no like-for-like cell to find (it minifies).
      const { rows } = cellRows(standing(cast, 6, pitch), cast.cell[0])
      measured[name] = { ...whole, cellPaintedRows: rows, cellPitchDeg: 25, texelsPerPixel: rows / heightPx }
      continue
    }
    // The stander is the woman facing the camera's bearing: the builder's direction 6. The cell compared is the builder's own idle
    // cell that this render's frame shows (bestIdle), and `standing` is the sheet's third idle step, kept for the record.
    const idle = bestIdle(cast, 6, frame, stander)
    const sheet = matchCell(frame, cellRows(standing(cast, 6), cast.cell[0]).frame, stander)
    measured[name] = { ...whole, ...groundReport(frame, idle, stander, sheet) }
    crops.push(idle.cell)
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
    ['exec', 'vitest', 'run', '--project', 'browser (chromium)', 'tests/browser/painted/gate-sheets.test.ts'],
    {
      cwd: KIT,
      stdio: 'inherit',
      env: { ...process.env, VITE_C7_GATE: '1', C7_GATE_OUT: out },
    },
  )
  if (sheets.status !== 0) throw new Error('the depth sheet failed')
  // The records are committed, and the repo's formatter owns JSON: leave them the way a commit would.
  spawnSync(
    'pnpm',
    ['exec', 'biome', 'format', '--write', join(out, 'measurements.json'), join(out, 'parity.json')],
    {
      cwd: REPO,
      stdio: 'inherit',
    },
  )
}

/**
 * The c8 gate (`gate lit`): the lit room's pictures from the kit's own browser projects (WebGL in Chromium; WebGPU in a Chromium
 * launched with it, software if the machine has no GPU), the bench's numbers, and the parity counts, into docs/refactor/c8/gate-lit/.
 * `measurements.json` is assembled from what those wrote, never typed.
 */
function gateLit(): void {
  const out = join(REPO, 'docs/refactor/c8/gate-lit')
  mkdirSync(out, { recursive: true })
  const run = (args: readonly string[], env: Record<string, string>) => {
    const done = spawnSync('pnpm', ['exec', 'vitest', 'run', ...args], {
      cwd: KIT,
      stdio: 'inherit',
      env: { ...process.env, ...env },
    })
    if (done.status !== 0) throw new Error(`${args.join(' ')} failed`)
  }
  const gate = { VITE_C8_GATE: '1', C7_GATE_OUT: out }
  run(['--project', 'browser (chromium)', 'tests/browser/painted/gate-lit.test.ts'], gate)
  run(['--project', 'webgpu', 'tests/browser/webgpu/gate-lit.test.ts'], {
    ...gate,
    AF_WEBGPU: process.env.AF_WEBGPU ?? 'software',
  })
  const benchOut = join(out, '.bench.json')
  // The bench asserts its median and may fail it; its numbers are the gate's either way.
  spawnSync('pnpm', ['exec', 'vitest', 'run', '--project', 'bench', 'tests/bench/lit.bench.test.ts'], {
    cwd: KIT,
    stdio: 'inherit',
    env: { ...process.env, AF_BENCH: '1', LIT_BENCH_OUT: benchOut },
  })
  const read = (name: string) =>
    existsSync(join(out, name)) ? JSON.parse(readFileSync(join(out, name), 'utf8')) : null
  const measurements = {
    bench: read('.bench.json'),
    webgl: read('lights.json'),
    webgpu: read('lights-webgpu.json'),
  }
  writeFileSync(join(out, 'measurements.json'), `${JSON.stringify(measurements, null, 2)}\n`)
  for (const name of ['lights.json', 'lights-webgpu.json', '.bench.json'])
    rmSync(join(out, name), { force: true })
  spawnSync('pnpm', ['exec', 'biome', 'format', '--write', join(out, 'measurements.json')], {
    cwd: REPO,
    stdio: 'inherit',
  })
}

const which = process.argv[2] ?? '1'
if (which === '1') await gateOne()
else if (which === 'lit') gateLit()
else throw new Error(`unknown gate ${which}`)

/**
 * Checks the Pixi 3D view against the painter (npm run view-check [-- OUT_DIR]).
 *
 * 1. The standing views (viewer/main.ts, `?check=D`): each base figure in each of the 8 views under an orthographic
 *    camera at the sheets' 18°, a texel to a pixel, in headless Chromium; every pixel the figure covers must be the
 *    sheets' cell's (frames.ts `standing`), texel for texel, and no pixel outside it may be drawn.
 * 2. The stage cases (viewer/cases.ts, `?case=NAME`): `StageView` draws the case's `StageFrame` and the readback is
 *    compared with `compose(frame)` computed here, under WebGL and, where the browser grants an adapter, under WebGPU (`&renderer=`;
 *    `webgpu: no adapter, skipped` otherwise). `bytes` cases: every byte equal. `palette` cases: alpha 0 or 255
 *    only, and every opaque pixel a colour some sprite's cell holds.
 * 3. Determinism: `scene4` drawn twice in one page load (`&twice`) and once in a fresh one, all three readbacks equal.
 *
 * `ONLY=<regex>` limits the run to the stage cases whose name matches (and skips 1 and 3), for working on one.
 *
 * Exits non-zero on any difference or page error. With OUT_DIR, also writes a CPU and a GPU PNG of the cases the gate
 * sheet shows (`/` in a name written `_`), and `gate.png`: the sheet the owner looks at (see `gateSheet`).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createCanvas } from '@napi-rs/canvas'
import { chromium, type Page } from 'playwright'
import { createServer } from 'vite'
import { BASE, compose, member, SPRITE_PITCH, type StageFrame, standing } from '../src'
import { CASES, wallBackdrop } from '../viewer/cases'

type Renderer = 'webgl' | 'webgpu'
const out = process.argv[2] ? resolve(process.argv[2]) : null
if (out) mkdirSync(out, { recursive: true })
const server = await createServer({
  root: resolve(import.meta.dirname, '../viewer'),
  server: { port: 0, host: '127.0.0.1' },
  logLevel: 'error',
})
await server.listen()
const url = server.resolvedUrls!.local[0]
// WebGPU needs its flag and, with no GPU, a software adapter that can also present a canvas (SwiftShader through Vulkan), as
// automata-framework's `webgpu` browser project launches it.
const browser = await chromium.launch({
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--enable-unsafe-webgpu',
    '--enable-features=Vulkan',
    '--use-vulkan=swiftshader',
  ],
})
const page = await browser.newPage()
/** The page's canvas as RGBA, read back through a 2D canvas (a WebGL canvas kept with `preserveDrawingBuffer`). */
async function readback(p: Page): Promise<{ w: number; h: number; rgba: Buffer }> {
  const shot = await p.evaluate(() => {
    // A WebGPU page copied its canvas in the task that drew it (viewer/main.ts `present`): the canvas itself is empty by now.
    const taken = (window as unknown as { __frame?: { w: number; h: number; b64: string } }).__frame
    if (taken) return taken
    const c = document.querySelector('canvas')!,
      copy = document.createElement('canvas')
    copy.width = c.width
    copy.height = c.height
    const g = copy.getContext('2d')!
    g.drawImage(c, 0, 0)
    const d = g.getImageData(0, 0, c.width, c.height).data
    let bin = ''
    for (let i = 0; i < d.length; i += 0x8000) bin += String.fromCharCode(...d.subarray(i, i + 0x8000))
    return { w: c.width, h: c.height, b64: btoa(bin) }
  })
  return { w: shot.w, h: shot.h, rgba: Buffer.from(shot.b64, 'base64') }
}
/** Draws a stage case on the page and reads it back. */
async function draw(
  name: string,
  query = '',
  renderer: Renderer = 'webgl',
): Promise<{ w: number; h: number; rgba: Buffer }> {
  await page.goto(`${url}?case=${encodeURIComponent(name)}&renderer=${renderer}${query}`)
  await page.waitForSelector('body[data-ready]', { timeout: 120_000 })
  const [depth, got] = await page.evaluate(() => [
    document.body.dataset.perTexelDepth,
    document.body.dataset.renderer,
  ])
  if (got !== renderer) errors.push(`${name}: asked for ${renderer}, the page drew with ${got}`)
  if (depth !== 'true')
    errors.push(
      `${name} [${renderer}]: StageView found no per-texel depth under this renderer (perTexelDepth ${depth})`,
    ) // the renderer check ran, and found the renderer it was asked for
  return readback(page)
}
/** The cases the gate sheet shows. */
const KEEP = new Set([
  'overlap',
  'wall',
  'day',
  'lit',
  'zoom/1',
  'zoom/3',
  'gameplay/crisp/1',
  'gameplay/x2/1',
])
const png = (rgba: ArrayLike<number>, w: number, h: number) => {
  const c = createCanvas(w, h),
    ctx = c.getContext('2d'),
    img = ctx.createImageData(w, h)
  img.data.set(rgba as Uint8ClampedArray)
  ctx.putImageData(img, 0, 0)
  return c.toBuffer('image/png')
}
/** The old rule, for the sheet's contrast: each sprite wholly over the earlier, in the frame's order. */
function painters(frame: StageFrame): Uint8ClampedArray {
  const out = new Uint8ClampedArray(frame.camera.size[0] * frame.camera.size[1] * 4)
  for (const s of frame.sprites) {
    const one = compose({ ...frame, sprites: [s] })
    for (let i = 0; i < one.length; i += 4) if (one[i + 3]) out.set(one.subarray(i, i + 4), i)
  }
  return out
}
/** A case kept for the gate sheet: the CPU frame, the GPU readback, and the frame (for where each figure stands). */
interface Kept {
  want: Uint8ClampedArray
  got: Buffer
  w: number
  h: number
  frame: StageFrame
  contrast?: Uint8ClampedArray
}
const kept = new Map<string, Kept>()

/**
 * The gate sheet (`gate.png`), drawn with nearest-neighbour upscales only:
 *   row 1  `day` (four actors, near and far): CPU | GPU | difference at ×2
 *   row 2  `lit` (a night lamp in the world): the same three
 *   row 3  two zooms, `zoom/1` (at ×3) and `zoom/3` (at ×2): CPU | GPU | difference for each
 *   row 4  the gameplay camera (GPU, ×1): the 640×480 frame, then the 1280×960 frame (a host's bigger frame)
 *   row 6  `overlap` (per-texel depth: a walking woman's nearer arm in front of a man standing before her) and `wall` (a wall quad
 *          cutting through a figure at the knees): CPU | GPU | difference | the contrast (the old whole-sprite order; the figure with no wall)
 *   row 5  the middle figure ×3: our original D2 render at the same bearing (`standing` at the renders' pitch), then a crop
 *          of each gameplay frame (crisp, D2, painted at the renders' pitch: one pixel a texel at 640×480, two at 1280×960)
 * The difference is the pixels whose RGBA bytes differ, magenta on black: expected, all black.
 */
function gateSheet(): Buffer {
  const PAD = 16,
    LABEL = 28,
    BG = '#31222a',
    INK = '#e8e0cf'
  const sized = (k: Kept, scale: number) => ({ w: k.w * scale, h: k.h * scale })
  const rowH = [['day'], ['lit'], ['zoom/1', 'zoom/3'], ['gameplay/crisp/1', 'gameplay/x2/1']].map(
    (r) =>
      Math.max(
        ...r.map((n) => sized(kept.get(n)!, n.startsWith('gameplay') ? 1 : n === 'zoom/1' ? 3 : 2).h),
      ) +
      LABEL +
      PAD,
  )
  rowH.push(3 * 280 + LABEL + PAD, ...['overlap', 'wall'].map((n) => sized(kept.get(n)!, 2).h + LABEL + PAD))
  const c = createCanvas(
      2944,
      rowH.reduce((a, b) => a + b, PAD),
    ),
    g = c.getContext('2d')
  g.fillStyle = '#1d1d21'
  g.fillRect(0, 0, c.width, c.height)
  g.imageSmoothingEnabled = false
  g.font = '20px sans-serif'
  g.textBaseline = 'top'
  /** An RGBA buffer, upscaled `scale`× with its top-left at (x, y), on a backing colour, labelled above. */
  const tile = (
    rgba: ArrayLike<number>,
    w: number,
    h: number,
    scale: number,
    x: number,
    y: number,
    label: string,
    bg = BG,
    crop?: [number, number, number, number],
  ) => {
    const [cx, cy, cw, ch] = crop ?? [0, 0, w, h],
      src = createCanvas(cw, ch),
      sg = src.getContext('2d'),
      img = sg.createImageData(cw, ch)
    for (let j = 0; j < ch; j++)
      for (let i = 0; i < cw; i++) {
        const X = cx + i,
          Y = cy + j,
          o = (j * cw + i) * 4
        if (X >= 0 && X < w && Y >= 0 && Y < h)
          for (let k = 0; k < 4; k++) img.data[o + k] = rgba[(Y * w + X) * 4 + k]
      }
    sg.putImageData(img, 0, 0)
    g.fillStyle = INK
    g.fillText(label, x, y)
    g.fillStyle = bg
    g.fillRect(x, y + LABEL, cw * scale, ch * scale)
    g.drawImage(src, x, y + LABEL, cw * scale, ch * scale)
  }
  /** CPU | GPU | difference of one kept case. */
  const triple = (name: string, x: number, y: number, scale = 2, contrast?: string) => {
    const k = kept.get(name)!,
      diff = new Uint8ClampedArray(k.w * k.h * 4)
    let n = 0
    for (let i = 0; i < k.w * k.h; i++) {
      const o = i * 4,
        same = [0, 1, 2, 3].every((j) => k.want[o + j] === k.got[o + j])
      diff[o + 3] = 255
      if (!same) {
        diff[o] = 255
        diff[o + 2] = 255
        n++
      }
    }
    const { w } = sized(k, scale)
    tile(k.want, k.w, k.h, scale, x, y, `${name} CPU`)
    tile(k.got, k.w, k.h, scale, x + w + PAD, y, `${name} GPU`)
    tile(diff, k.w, k.h, scale, x + 2 * (w + PAD), y, `${name} diff: ${n} px`, '#000000')
    if (k.contrast) tile(k.contrast, k.w, k.h, scale, x + 3 * (w + PAD), y, `${name} ${contrast}`)
    return (k.contrast ? 4 : 3) * w + (k.contrast ? 3 : 2) * PAD
  }
  let y = PAD
  triple('day', PAD, y)
  y += rowH[0]
  triple('lit', PAD, y)
  y += rowH[1]
  const used = triple('zoom/1', PAD, y, 3)
  triple('zoom/3', PAD + used + 2 * PAD, y)
  y += rowH[2]
  const small = kept.get('gameplay/crisp/1')!,
    big = kept.get('gameplay/x2/1')!
  tile(small.got, small.w, small.h, 1, PAD, y, 'gameplay camera 640×480 (GPU): crisp, D2, painted at 18°')
  tile(
    big.got,
    big.w,
    big.h,
    1,
    2 * PAD + small.w,
    y,
    'gameplay camera 1280×960 (GPU): crisp, D2, painted at 18°',
  )
  y += rowH[3]
  // the middle actor (base-f, the second of the trio, at the origin), ×3: a crop round its root pixel
  const mid = (k: Kept) => k.frame.sprites.find((p) => p.name === 'base-f')!
  const cropOf = (s: StageFrame['sprites'][number]): [number, number, number, number] => {
    const ax = Math.round(s.screen[0] + s.scale * s.cell.anchor[0]),
      ay = Math.round(s.screen[1] + s.scale * s.cell.anchor[1]),
      m = s.scale
    return [ax - 45 * m, ay - 130 * m, 90 * m, 140 * m]
  }
  // our original render at the same bearing: the sheets' `standing` at D2 and the renders' pitch
  const dir = mid(small).cell.direction,
    cast = member(BASE.find((b) => b.def.id === 'base-f')!.def, 2),
    orig = standing(cast, dir, SPRITE_PITCH)
  const ax = Math.round(cast.cell[0] / 2),
    ay = Math.round(cast.cell[1] - cast.feet)
  tile(orig, cast.cell[0], cast.cell[1], 3, PAD, y, `original D2 render, view ${dir} ×3`, BG, [
    ax - 45,
    ay - 130,
    90,
    140,
  ])
  tile(small.got, small.w, small.h, 3, 2 * PAD + 270, y, '640×480 frame ×3', BG, cropOf(mid(small)))
  tile(big.got, big.w, big.h, 3, 3 * PAD + 540, y, '1280×960 frame ×3', BG, cropOf(mid(big)))
  y += rowH[4]
  triple('overlap', PAD, y, 2, 'old order (whole sprites)')
  y += rowH[5]
  triple('wall', PAD, y, 2, 'no wall')
  return c.toBuffer('image/png')
}
const at = (i: number, w: number) => `(${(i >> 2) % w}, ${Math.floor((i >> 2) / w)})`
const errors: string[] = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`)
})
const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null
let failed = 0
try {
  for (const [who, b] of only ? [] : BASE.entries()) {
    const cast = member(b.def, 2),
      [w, h] = cast.cell
    for (let d = 0; d < 8; d++) {
      await page.goto(`${url}?check=${d}&who=${who}`)
      await page.waitForSelector('body[data-ready]', { timeout: 60_000 })
      const shot = await page.evaluate(() => {
        const c = document.querySelector('canvas')!,
          copy = document.createElement('canvas')
        copy.width = c.width
        copy.height = c.height
        const g = copy.getContext('2d')!
        g.drawImage(c, 0, 0)
        return {
          w: c.width,
          h: c.height,
          px: Array.from(g.getImageData(0, 0, c.width, c.height).data),
          png: copy.toDataURL('image/png'),
        }
      })
      if (out)
        writeFileSync(join(out, `${b.def.id}-view${d}.png`), Buffer.from(shot.png.split(',')[1], 'base64'))
      const cell = standing(cast, d)
      if (shot.w !== w || shot.h !== h) {
        console.log(`${b.def.id} view ${d}: canvas ${shot.w}×${shot.h}, cell ${w}×${h}`)
        failed++
        continue
      }
      let wrong = 0,
        first = ''
      for (let i = 0; i < w * h; i++) {
        const a = cell[i * 4 + 3] > 0,
          drawn = shot.px[i * 4 + 3] > 0
        const same = a ? drawn && [0, 1, 2].every((k) => cell[i * 4 + k] === shot.px[i * 4 + k]) : !drawn
        if (!same) {
          wrong++
          if (!first)
            first = `(${i % w}, ${Math.floor(i / w)}) cell ${Array.from(cell.slice(i * 4, i * 4 + 4))} drawn ${shot.px.slice(i * 4, i * 4 + 4)}`
        }
      }
      console.log(
        `${b.def.id} view ${d}: ${wrong === 0 ? 'identical' : `${wrong} pixels differ, first ${first}`}`,
      )
      if (wrong) failed++
    }
  }
  // The stage cases, under each renderer: WebGL, and WebGPU where the browser grants an adapter.
  await page.goto(url)
  const adapter = await page.evaluate(
    async () =>
      (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu?.requestAdapter().then(
        (a) => a !== null,
        () => false,
      ) ?? false,
  )
  const renderers: Renderer[] = adapter ? ['webgl', 'webgpu'] : ['webgl']
  if (!adapter) console.log('webgpu: no adapter, skipped')
  for (const renderer of renderers)
    for (const [name, c] of Object.entries(CASES)) {
      if (only && !only.test(name)) continue
      const tag = renderer === 'webgl' ? name : `${name} [webgpu]`
      const frame = c.frame(),
        want = compose(frame, c.wall && wallBackdrop(frame.camera, c.wall)),
        [W, H] = frame.camera.size,
        got = await draw(name, '', renderer)
      if (out && renderer === 'webgl' && KEEP.has(name)) {
        kept.set(name, {
          want,
          got: got.rgba,
          w: W,
          h: H,
          frame,
          contrast: name === 'overlap' ? painters(frame) : name === 'wall' ? compose(frame) : undefined,
        })
        writeFileSync(join(out, `${name.replace(/\//g, '_')}.gpu.png`), png(got.rgba, W, H))
        writeFileSync(join(out, `${name.replace(/\//g, '_')}.cpu.png`), png(want, W, H))
      }
      if (got.w !== W || got.h !== H) {
        console.log(`${tag}: canvas ${got.w}×${got.h}, frame ${W}×${H}`)
        failed++
        continue
      }
      if (c.claim === 'bytes') {
        let wrong = 0,
          first = -1
        for (let i = 0; i < want.length; i += 4)
          if (
            want[i] !== got.rgba[i] ||
            want[i + 1] !== got.rgba[i + 1] ||
            want[i + 2] !== got.rgba[i + 2] ||
            want[i + 3] !== got.rgba[i + 3]
          ) {
            wrong++
            if (first < 0) first = i
          }
        console.log(
          `${tag}: ${wrong === 0 ? 'identical' : `${wrong} pixels differ, first ${at(first, W)} cpu ${Array.from(want.slice(first, first + 4))} gpu ${Array.from(got.rgba.subarray(first, first + 4))}`}`,
        )
        if (wrong) failed++
      } else {
        const held = new Set<number>()
        for (const s of frame.sprites)
          for (let i = 0; i < s.cell.rgba.length; i += 4)
            if (s.cell.rgba[i + 3])
              held.add((s.cell.rgba[i] << 16) | (s.cell.rgba[i + 1] << 8) | s.cell.rgba[i + 2])
        let bad = ''
        for (let i = 0; i < got.rgba.length && !bad; i += 4) {
          const a = got.rgba[i + 3],
            rgb = (got.rgba[i] << 16) | (got.rgba[i + 1] << 8) | got.rgba[i + 2]
          if (a !== 0 && a !== 255) bad = `alpha ${a} at ${at(i, W)}`
          else if (a === 255 && !held.has(rgb))
            bad = `new colour #${rgb.toString(16).padStart(6, '0')} at ${at(i, W)}`
        }
        console.log(`${tag}: ${bad ? `palette broken: ${bad}` : 'palette holds'}`)
        if (bad) failed++
      }
    }
  // Determinism: scene4 twice in one page load, and once in a fresh one.
  if (!only) {
    const once = await draw('scene4'),
      twice = await draw('scene4', '&twice'),
      fresh = await draw('scene4')
    const same = Buffer.compare(once.rgba, twice.rgba) === 0 && Buffer.compare(once.rgba, fresh.rgba) === 0
    console.log(`scene4: ${same ? 'deterministic' : 'readbacks differ between draws'}`)
    if (!same) failed++
  }
} finally {
  await browser.close()
  await server.close()
}
if (out && kept.size === KEEP.size) writeFileSync(join(out, 'gate.png'), gateSheet())
if (errors.length) {
  console.log(errors.join('\n'))
  failed++
}
process.exit(failed ? 1 : 0)

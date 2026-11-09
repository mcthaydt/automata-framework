// The snap on a real WebGL2 context: it picks the colour the CPU's snap picks (nearest in OKLab), it rounds a stored colour
// plus a Bayer offset as the painter's own snap does, and it leaves painted cells and the sky as they are. A test pass
// that draws known colours from pixel positions runs first, so no mesh, light or texture filtering stands between the
// colour the test means and the colour the snap reads. WebGPU is the GPU runner's.
import '#src/entries/no-eval.ts'
import { CubeGeometry, FlatMaterial, Mesh3D, type Pass3D, PostEffect } from '@pixi/3d'
import { UniformGroup } from 'pixi.js'
import { afterEach, describe, expect, it } from 'vitest'
import { createPixi3dRenderer } from '#src/app/create-renderer.ts'
import { DuelSnapEffect } from '#src/features/look/duel-snap-filter.ts'
import { FinishEffect } from '#src/features/look/finish-effect.ts'
import { DUEL, duel } from '#src/shared/math/duel.ts'
import { alphaCodeGlsl, alphaCodeWgsl } from '#src/shared/render/alpha/alpha-codes.ts'
import { BAYER } from '#src/shared/render/texel.ts'
import { builtRenderer } from '#src/testing/built-renderer.ts'
import { snapshot } from '#src/testing/snapshot.ts'
import { testTarget } from '#src/testing/test-target.ts'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null
const frame = { alpha: 1, frameMs: 16, paused: false }
const W = 360
const H = 360
/** The test stage's bars cover the field's top and bottom rows; the test colours start below them, on a multiple of 4. */
const TOP = 20

class Stub extends PostEffect {
  protected override readonly fragment: { gpu: string; gl: string }
  protected override readonly uniforms = new UniformGroup({ uUnused: { value: 0, type: 'f32' } })
  constructor(gl: string, gpu: string) {
    super()
    this.fragment = { gl: `${alphaCodeGlsl()}\n${gl}`, gpu: `${alphaCodeWgsl()}\n${gpu}` }
  }
}

/** The two ways a test reads a pixel back: its colour with alpha 1, or its alpha as a grey. */
const show = (what: 'rgb' | 'alpha'): Stub =>
  what === 'rgb'
    ? new Stub(
        `vec4 effect(vec2 uv) { return vec4(sampleColor(uv).rgb, 1.0); }`,
        `fn effect(uv: vec2<f32>) -> vec4<f32> { return vec4<f32>(sampleColor(uv).rgb, 1.0); }`,
      )
    : new Stub(
        `vec4 effect(vec2 uv) { float a = sampleColor(uv).a; return vec4(a, a, a, 1.0); }`,
        `fn effect(uv: vec2<f32>) -> vec4<f32> { let a = sampleColor(uv).a; return vec4<f32>(a, a, a, 1.0); }`,
      )

let scope: { dispose(): void } | undefined
afterEach(() => {
  scope?.dispose()
  scope = undefined
  document.body.replaceChildren()
})

/** Draws what `source` (a pass writing known colours) makes, through the snap at `dither`, and reads the canvas. */
async function drawThrough(
  source: Stub,
  dither: number,
  read: 'rgb' | 'alpha' = 'rgb',
): Promise<Uint8ClampedArray | Uint8Array> {
  return drawPasses([source, new DuelSnapEffect(dither), show(read)])
}

async function drawPasses(
  passes: readonly Pass3D[],
  background = 0x000000,
): Promise<Uint8ClampedArray | Uint8Array> {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const factory = createPixi3dRenderer({
    logicalWidth: W,
    logicalHeight: H,
    backgroundColor: background,
    views: {},
    scene: (view) => {
      // A far speck, so the view has something to draw and runs its passes.
      const speck = new Mesh3D({
        geometry: new CubeGeometry(),
        material: new FlatMaterial({ baseColor: 0x000000 }),
      })
      speck.position.set(500, 0, -500)
      view.root.addChild(speck)
      view.passes = [...passes]
      return undefined
    },
  })
  const renderer = await builtRenderer(factory(testTarget(host, {}, { width: W, height: H })))
  scope = renderer
  renderer.draw(frame)
  renderer.draw(frame)
  return snapshot(renderer)
}

const at = (pixels: ArrayLike<number>, x: number, y: number): number => {
  const o = (y * W + x) * 4
  return ((pixels[o] ?? 0) << 16) | ((pixels[o + 1] ?? 0) << 8) | (pixels[o + 2] ?? 0)
}
const channelsOf = (c: number): [number, number, number] => [(c >> 16) & 255, (c >> 8) & 255, c & 255]

/** The squared OKLab distances from a colour to the best and to the second-best DUEL colour. */
function twoNearest(rgb: number): [number, number] {
  const [r, g, b] = channelsOf(rgb)
  void r
  void g
  void b
  const lab = oklabOf(rgb)
  const ds = DUEL.map(
    (d) => (d.lab[0] - lab[0]) ** 2 + (d.lab[1] - lab[1]) ** 2 + (d.lab[2] - lab[2]) ** 2,
  ).sort((p, q) => p - q)
  return [ds[0] ?? 0, ds[1] ?? 0]
}

import { oklab as oklabOf } from '#src/shared/math/colour.ts'

describe.runIf(hasWebGL2)('the snap on WebGL2', () => {
  it('picks the colour the CPU’s snap picks, over a 17³ grid of colours, but where two are a tie', async () => {
    // Pixel (x, TOP + r) of the grid: red r, then green and blue from x (17 × 17 = 289 across).
    const level = (i: number): number => Math.floor((i * 255) / 16 + 0.5)
    const grid = new Stub(
      `vec4 effect(vec2 uv) {
        vec2 p = floor(uv / texel());
        float r = p.y - ${TOP}.0;
        if (r < 0.0 || r > 16.0 || p.x > 288.0) return vec4(0.0);
        float g = floor(p.x / 17.0);
        float b = mod(p.x, 17.0);
        return vec4(floor(r * 255.0 / 16.0 + 0.5) / 255.0, floor(g * 255.0 / 16.0 + 0.5) / 255.0, floor(b * 255.0 / 16.0 + 0.5) / 255.0, 1.0);
      }`,
      `fn effect(uv: vec2<f32>) -> vec4<f32> {
        let p = floor(uv / texel());
        let r = p.y - ${TOP}.0;
        if (r < 0.0 || r > 16.0 || p.x > 288.0) { return vec4<f32>(0.0); }
        let g = floor(p.x / 17.0);
        let b = p.x % 17.0;
        return vec4<f32>(floor(r * 255.0 / 16.0 + 0.5) / 255.0, floor(g * 255.0 / 16.0 + 0.5) / 255.0, floor(b * 255.0 / 16.0 + 0.5) / 255.0, 1.0);
      }`,
    )
    const pixels = await drawThrough(grid, 0)
    let wrong = 0
    let ties = 0
    for (let r = 0; r <= 16; r++)
      for (let g = 0; g <= 16; g++)
        for (let b = 0; b <= 16; b++) {
          const stored = (level(r) << 16) | (level(g) << 8) | level(b)
          const got = at(pixels, g * 17 + b, TOP + r)
          const want = duel(stored)
          if (got === want) continue
          const [first, second] = twoNearest(stored)
          // A tie within what a float's cube root can tell apart: either answer is the nearest.
          if (second - first < 1e-5) ties++
          else wrong++
        }
    console.info(`17³ grid: ${ties} colours equidistant from two palette colours`)
    expect(wrong).toBe(0)
    expect(ties).toBeLessThan(25)
  })

  it('rounds a stored colour plus each Bayer offset as the painter’s snap does', async () => {
    // 4096 colours in 4 × 4 blocks, one block each, 90 blocks across.
    const BLOCKS = 90
    const colourOf = (n: number): [number, number, number] => [
      (n * 167 + 13) % 256,
      (n * 211 + 71) % 256,
      (n * 89 + 5) % 256,
    ]
    const strength = 0.04
    const bayer = new Stub(
      `vec4 effect(vec2 uv) {
        vec2 p = floor(uv / texel());
        float y = p.y - ${TOP}.0;
        if (y < 0.0 || y >= 184.0) return vec4(0.0);
        float n = floor(y / 4.0) * ${BLOCKS}.0 + floor(p.x / 4.0);
        return vec4(mod(n * 167.0 + 13.0, 256.0) / 255.0, mod(n * 211.0 + 71.0, 256.0) / 255.0, mod(n * 89.0 + 5.0, 256.0) / 255.0, 1.0);
      }`,
      `fn effect(uv: vec2<f32>) -> vec4<f32> {
        let p = floor(uv / texel());
        let y = p.y - ${TOP}.0;
        if (y < 0.0 || y >= 184.0) { return vec4<f32>(0.0); }
        let n = floor(y / 4.0) * ${BLOCKS}.0 + floor(p.x / 4.0);
        return vec4<f32>((n * 167.0 + 13.0) % 256.0 / 255.0, (n * 211.0 + 71.0) % 256.0 / 255.0, (n * 89.0 + 5.0) % 256.0 / 255.0, 1.0);
      }`,
    )
    const pixels = await drawThrough(bayer, strength)
    let wrong = 0
    let ties = 0
    for (let n = 0; n < 4096; n++) {
      const [r, g, b] = colourOf(n)
      for (let dy = 0; dy < 4; dy++)
        for (let dx = 0; dx < 4; dx++) {
          const offset = ((BAYER[dx + dy * 4] ?? 0) / 16 - 0.5) * strength
          const q = (v: number): number => Math.min(255, Math.max(0, Math.round((v / 255 + offset) * 255)))
          const want = (q(r) << 16) | (q(g) << 8) | q(b)
          const x = (n % BLOCKS) * 4 + dx
          const y = TOP + Math.floor(n / BLOCKS) * 4 + dy
          const got = at(pixels, x, y)
          if (got === duel(want)) continue
          const [first, second] = twoNearest(want)
          if (second - first < 1e-5) ties++
          else wrong++
        }
    }
    console.info(`Bayer: ${ties} of 65536 pixels equidistant from two palette colours`)
    expect(wrong).toBe(0)
    expect(ties).toBeLessThan(200)
  })

  it('leaves the sky and painted cells as they are, and snaps world and glowing pixels', async () => {
    // One colour that is no palette colour, drawn with each alpha code in its own band of columns.
    const odd = [0.37, 0.52, 0.81]
    const codes = [160, 192, 224, 255]
    const bands = new Stub(
      `vec4 effect(vec2 uv) {
        vec2 p = floor(uv / texel());
        if (p.y < ${TOP}.0 || p.y > ${TOP + 8}.0 || p.x > 39.0) return vec4(0.0);
        float band = floor(p.x / 10.0);
        float a = band < 0.5 ? 160.0 : (band < 1.5 ? 192.0 : (band < 2.5 ? 224.0 : 255.0));
        return vec4(${odd.map((v) => v.toFixed(2)).join(', ')}, a / 255.0);
      }`,
      `fn effect(uv: vec2<f32>) -> vec4<f32> {
        let p = floor(uv / texel());
        if (p.y < ${TOP}.0 || p.y > ${TOP + 8}.0 || p.x > 39.0) { return vec4<f32>(0.0); }
        let band = floor(p.x / 10.0);
        var a = 255.0;
        if (band < 0.5) { a = 160.0; } else if (band < 1.5) { a = 192.0; } else if (band < 2.5) { a = 224.0; }
        return vec4<f32>(${odd.map((v) => v.toFixed(2)).join(', ')}, a / 255.0);
      }`,
    )
    const pixels = await drawThrough(bands, 0)
    const stored = (odd.map((v) => Math.round(v * 255)) as [number, number, number]).reduce(
      (n, c) => (n << 8) | c,
      0,
    )
    const bandColour = (band: number): number => at(pixels, band * 10 + 5, TOP + 4)
    expect(bandColour(0)).toBe(stored)
    expect(bandColour(1)).toBe(stored)
    expect(bandColour(2)).toBe(duel(stored))
    expect(bandColour(3)).toBe(duel(stored))
    expect(codes.length).toBe(4)
  })

  it('keeps each pixel’s alpha, so the finish can tell what it was', async () => {
    const bands = new Stub(
      `vec4 effect(vec2 uv) {
        vec2 p = floor(uv / texel());
        if (p.y < ${TOP}.0 || p.y > ${TOP + 8}.0 || p.x > 39.0) return vec4(0.0);
        float band = floor(p.x / 10.0);
        float a = band < 0.5 ? 160.0 : (band < 1.5 ? 192.0 : (band < 2.5 ? 224.0 : 255.0));
        return vec4(0.37, 0.52, 0.81, a / 255.0);
      }`,
      `fn effect(uv: vec2<f32>) -> vec4<f32> {
        let p = floor(uv / texel());
        if (p.y < ${TOP}.0 || p.y > ${TOP + 8}.0 || p.x > 39.0) { return vec4<f32>(0.0); }
        let band = floor(p.x / 10.0);
        var a = 255.0;
        if (band < 0.5) { a = 160.0; } else if (band < 1.5) { a = 192.0; } else if (band < 2.5) { a = 224.0; }
        return vec4<f32>(0.37, 0.52, 0.81, a / 255.0);
      }`,
    )
    const pixels = await drawThrough(bands, 0, 'alpha')
    const grey = (band: number): number => at(pixels, band * 10 + 5, TOP + 4) & 255
    expect([0, 1, 2, 3].map(grey)).toEqual([160, 192, 224, 255])
  })
})

describe.runIf(hasWebGL2)('the finish on WebGL2', () => {
  /** Two bands of the palette's colour 10, drawn with alpha 192 (painted) and 1 (world), and a band of nothing. */
  const source = (): Stub =>
    new Stub(
      `vec4 effect(vec2 uv) {
        vec2 p = floor(uv / texel());
        if (p.y < ${TOP}.0 || p.y > ${TOP + 8}.0 || p.x > 29.0) return vec4(0.0);
        vec3 c = DUEL_RGB_10;
        float band = floor(p.x / 10.0);
        return band < 0.5 ? vec4(c, 192.0 / 255.0) : (band < 1.5 ? vec4(c, 1.0) : vec4(c, 0.0));
      }`.replace(
        'DUEL_RGB_10',
        `vec3(${channelsOf(DUEL[10]?.c ?? 0)
          .map((v) => (v / 255).toFixed(6))
          .join(', ')})`,
      ),
      `fn effect(uv: vec2<f32>) -> vec4<f32> {
        let p = floor(uv / texel());
        if (p.y < ${TOP}.0 || p.y > ${TOP + 8}.0 || p.x > 29.0) { return vec4<f32>(0.0); }
        let c = DUEL_RGB_10;
        let band = floor(p.x / 10.0);
        if (band < 0.5) { return vec4<f32>(c, 192.0 / 255.0); }
        if (band < 1.5) { return vec4<f32>(c, 1.0); }
        return vec4<f32>(c, 0.0);
      }`.replace(
        'DUEL_RGB_10',
        `vec3<f32>(${channelsOf(DUEL[10]?.c ?? 0)
          .map((v) => (v / 255).toFixed(6))
          .join(', ')})`,
      ),
    )
  const BACKGROUND = 0x2e222f

  it('makes what was drawn opaque and leaves the stage’s colour where nothing was', async () => {
    const pixels = await drawPasses([source(), new FinishEffect(undefined)], BACKGROUND)
    const band = (n: number): number => at(pixels, n * 10 + 5, TOP + 4)
    expect(band(0)).toBe(DUEL[10]?.c)
    expect(band(1)).toBe(DUEL[10]?.c)
    expect(band(2)).toBe(BACKGROUND)
  })

  it('moves each colour to the one its table names', async () => {
    const table = Uint8Array.from({ length: 256 }, (_, i) => (i === 10 ? 200 : i))
    const moved = await drawPasses([source(), new FinishEffect(table)], BACKGROUND)
    expect(at(moved, 5, TOP + 4)).toBe(DUEL[200]?.c)
    expect(at(moved, 15, TOP + 4)).toBe(DUEL[200]?.c)
    // A table that moves nothing is a pass that draws what it was given.
    const identity = await drawPasses(
      [source(), new FinishEffect(Uint8Array.from({ length: 256 }, (_, i) => i))],
      BACKGROUND,
    )
    expect(at(identity, 5, TOP + 4)).toBe(DUEL[10]?.c)
  })
})

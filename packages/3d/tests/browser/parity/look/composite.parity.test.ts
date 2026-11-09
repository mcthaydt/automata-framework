// The cell composite pass and the alpha codes on a real WebGL2 context. WebGPU is the GPU runner's (Chromium here has no
// adapter): the same cases run there under `hasWebGPU`.
import '#src/entries/no-eval.ts'
import { DEFAULT_PALETTE } from '@automata/content/palette'
import { CubeGeometry, FlatMaterial, Mesh3D, PostEffect, type ShaderBit } from '@pixi/3d'
import { UniformGroup } from 'pixi.js'
import { afterEach, describe, expect, it } from 'vitest'
import { createPixi3dRenderer } from '#src/app/create-renderer.ts'
import {
  CellCompositePass,
  cellTexture,
  type PlacedCell,
} from '#src/features/figures/layer/cell-composite-pass.ts'
import {
  ALPHA,
  alphaCodeGlsl,
  alphaCodeWgsl,
  codeOfAlpha,
  packDepth,
  packedDepthBytes,
} from '#src/shared/render/alpha/alpha-codes.ts'
import { builtRenderer } from '#src/testing/built-renderer.ts'
import { snapshot } from '#src/testing/snapshot.ts'
import { testTarget } from '#src/testing/test-target.ts'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null
// The test stage draws its field with a few rows of bar above and below (the frame layout), so cells stand clear of the
// top and bottom five rows.
const W = 160
const H = 90
const frame = { alpha: 1, frameMs: 16, paused: false }

const rgbOfHex = (hex: string): [number, number, number] => {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}
const DUEL = DEFAULT_PALETTE.colors.map(rgbOfHex)

/** A test cell: `rgba` bytes row by row, top first, and its flat depth (0 m from the root). */
interface Sheet {
  readonly width: number
  readonly height: number
  readonly rgba: Uint8Array
}
function sheet(
  width: number,
  height: number,
  colourAt: (x: number, y: number) => [number, number, number],
): Sheet {
  const rgba = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) rgba.set([...colourAt(x, y), 255], (y * width + x) * 4)
  return { width, height, rgba }
}
const CHECKER_4x6 = sheet(4, 6, (x, y) => DUEL[(x + y * 4) % DUEL.length] as [number, number, number])
const SOLID = sheet(4, 6, () => DUEL[3] as [number, number, number])
const TOP_ROW_MARKED_4x6 = sheet(4, 6, (x, y) =>
  y === 0 ? (DUEL[x + 1] as [number, number, number]) : (DUEL[0] as [number, number, number]),
)

function cellOf(s: Sheet, x: number, y: number, rootDepth = 5): PlacedCell {
  const [hi, lo] = packedDepthBytes(packDepth(0))
  const depth = new Uint8Array(s.width * s.height * 4)
  for (let i = 0; i < s.width * s.height; i++) depth.set([hi, lo, 0, 255], i * 4)
  return {
    colours: cellTexture(s.rgba, s.width, s.height),
    depth: cellTexture(depth, s.width, s.height),
    source: [0, 0],
    x,
    y,
    width: s.width,
    height: s.height,
    rootDepth,
  }
}

/** Test-only post effects, in GLSL and WGSL. */
class Stub extends PostEffect {
  protected override readonly fragment: { gpu: string; gl: string }
  protected override readonly uniforms = new UniformGroup({ uUnused: { value: 0, type: 'f32' } })
  constructor(gl: string, gpu: string) {
    super()
    this.fragment = { gl: `${alphaCodeGlsl()}\n${gl}`, gpu: `${alphaCodeWgsl()}\n${gpu}` }
  }
}

/** The snap, as far as the codes matter: a painted pixel passes, anything else goes to one flat colour. */
const snapStub = (): Stub =>
  new Stub(
    `vec4 effect(vec2 uv) { vec4 c = sampleColor(uv); if (isPainted(c.a)) return c; return vec4(1.0, 0.0, 1.0, c.a); }`,
    `fn effect(uv: vec2<f32>) -> vec4<f32> { let c = sampleColor(uv); if (isPainted(c.a)) { return c; } return vec4<f32>(1.0, 0.0, 1.0, c.a); }`,
  )
/** The finish: alpha 1 where anything was drawn, colour 0 where nothing was (the view is blended premultiplied). */
const finishStub = (): Stub =>
  new Stub(
    `vec4 effect(vec2 uv) { vec4 c = sampleColor(uv); if (isDrawn(c.a)) return vec4(c.rgb, 1.0); return vec4(0.0); }`,
    `fn effect(uv: vec2<f32>) -> vec4<f32> { let c = sampleColor(uv); if (isDrawn(c.a)) { return vec4<f32>(c.rgb, 1.0); } return vec4<f32>(0.0); }`,
  )
/** Shows a channel of what the passes before wrote as an opaque colour, so a test can read alpha off the canvas. */
const probeStub = (what: 'alpha' | 'raw'): Stub =>
  what === 'alpha'
    ? new Stub(
        `vec4 effect(vec2 uv) { float a = sampleColor(uv).a; return vec4(a, a, a, 1.0); }`,
        `fn effect(uv: vec2<f32>) -> vec4<f32> { let a = sampleColor(uv).a; return vec4<f32>(a, a, a, 1.0); }`,
      )
    : new Stub(
        `vec4 effect(vec2 uv) { return vec4(sampleColor(uv).rgb, 1.0); }`,
        `fn effect(uv: vec2<f32>) -> vec4<f32> { return vec4<f32>(sampleColor(uv).rgb, 1.0); }`,
      )

/** A material whose last bit writes a code as its alpha, dividing its colour by the code first (the template premultiplies). */
const codeBit = (code: number): ShaderBit => ({
  name: `testCode${code}`,
  gpu: {
    fragment: { end: `\n  finalColor = finalColor / ${code.toFixed(6)};\n  alpha = ${code.toFixed(6)};\n` },
  },
  gl: {
    fragment: { end: `\n  finalColor = finalColor / ${code.toFixed(6)};\n  alpha = ${code.toFixed(6)};\n` },
  },
})

interface Draw {
  readonly cells?: readonly PlacedCell[]
  /** A wall across the whole view, `nearer` metres from the camera (the camera stands 5 m from the origin). */
  readonly wall?: { readonly distance: number; readonly alpha?: number; readonly code?: number }
  readonly snap?: boolean
  readonly finish?: boolean
  readonly probe?: 'alpha' | 'raw'
}

let scope: { dispose(): void } | undefined
afterEach(() => {
  scope?.dispose()
  scope = undefined
  document.body.replaceChildren()
})

async function drawWith(options: Draw): Promise<{ pixels: Uint8ClampedArray | Uint8Array }> {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const pass = new CellCompositePass()
  pass.show(options.cells ?? [])
  const factory = createPixi3dRenderer({
    logicalWidth: W,
    logicalHeight: H,
    backgroundColor: 0x000000,
    views: {},
    scene: (view) => {
      view.camera.position.set(0, 0, 5)
      view.camera.lookAt({ x: 0, y: 0, z: 0 })
      // A view with no mesh draws no frame at all (the beta returns early), so a far speck stands in for a room.
      const speck = new Mesh3D({
        geometry: new CubeGeometry(),
        material: new FlatMaterial({ baseColor: 0x000000 }),
      })
      speck.position.set(500, 0, -500)
      view.root.addChild(speck)
      if (options.wall) {
        const { distance, alpha, code } = options.wall
        const material = new FlatMaterial({
          baseColor: 0xf9c22b,
          ...(alpha !== undefined && { alphaMode: 'blend' as const, alpha }),
          ...(code !== undefined && { extraBits: [codeBit(code)] }),
        })
        const wall = new Mesh3D({ geometry: new CubeGeometry(), material })
        wall.scale.set(40, 40, 0.1)
        wall.position.set(0, 0, 5 - distance)
        view.root.addChild(wall)
      }
      view.passes = [
        pass,
        ...(options.snap ? [snapStub()] : []),
        ...(options.finish === false ? [] : [finishStub()]),
        ...(options.probe ? [probeStub(options.probe)] : []),
      ]
      return undefined
    },
  })
  const renderer = await builtRenderer(factory(testTarget(host, {})))
  scope = renderer
  renderer.draw(frame)
  return { pixels: snapshot(renderer) }
}

/** The RGB bytes of a w×h region at (x, y), row by row. */
function region(pixels: ArrayLike<number>, x: number, y: number, w: number, h: number): number[][] {
  const out: number[][] = []
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const at = ((y + j) * W + x + i) * 4
      out.push([pixels[at] ?? 0, pixels[at + 1] ?? 0, pixels[at + 2] ?? 0])
    }
  return out
}
const rgbRows = (s: Sheet, rows = s.height): number[][] => {
  const out: number[][] = []
  for (let i = 0; i < s.width * rows; i++)
    out.push([s.rgba[i * 4] ?? 0, s.rgba[i * 4 + 1] ?? 0, s.rgba[i * 4 + 2] ?? 0])
  return out
}

describe.runIf(hasWebGL2)('the cell composite pass on WebGL2', () => {
  it('a cell lands on its pixels with its colours unchanged', async () => {
    const { pixels } = await drawWith({ cells: [cellOf(CHECKER_4x6, 10, 20)] })
    expect(region(pixels, 10, 20, 4, 6)).toEqual(rgbRows(CHECKER_4x6))
  })

  it('a cell lands upright', async () => {
    const { pixels } = await drawWith({ cells: [cellOf(TOP_ROW_MARKED_4x6, 10, 20)] })
    expect(region(pixels, 10, 20, 4, 1)).toEqual(rgbRows(TOP_ROW_MARKED_4x6, 1))
    expect(region(pixels, 10, 25, 4, 1)).toEqual(rgbRows(TOP_ROW_MARKED_4x6).slice(20, 24))
  })

  it('a wall in front hides the texels behind it and a cell in front of the wall is seen', async () => {
    const wallOnly = await drawWith({ wall: { distance: 4 } })
    const behind = await drawWith({ cells: [cellOf(SOLID, 10, 23, 6)], wall: { distance: 4 } })
    expect(region(behind.pixels, 10, 23, 4, 6)).toEqual(region(wallOnly.pixels, 10, 23, 4, 6))
    const before = await drawWith({ cells: [cellOf(SOLID, 10, 23, 2)], wall: { distance: 4 } })
    expect(region(before.pixels, 10, 23, 4, 6)).toEqual(rgbRows(SOLID))
  })

  it('the snap leaves painted pixels alone and the finish writes alpha 1 where anything was drawn, else colour 0', async () => {
    const cells = [cellOf(CHECKER_4x6, 10, 20)]
    const snapped = await drawWith({ cells, snap: true })
    expect(region(snapped.pixels, 10, 20, 4, 6)).toEqual(rgbRows(CHECKER_4x6))
    const alpha = await drawWith({ cells, snap: true, probe: 'alpha' })
    expect(region(alpha.pixels, 10, 20, 4, 6).every(([r]) => r === 255)).toBe(true)
    expect(region(alpha.pixels, 100, 50, 4, 4).every(([r]) => r === 0)).toBe(true)
    const raw = await drawWith({ cells, snap: true, probe: 'raw' })
    expect(region(raw.pixels, 100, 50, 4, 4).every((p) => p.every((v) => v === 0))).toBe(true)
  })

  it('the painted code survives to the post chain', async () => {
    const { pixels } = await drawWith({ cells: [cellOf(SOLID, 30, 30)], finish: false, probe: 'alpha' })
    const [r] = region(pixels, 30, 30, 1, 1)[0] as number[]
    expect(codeOfAlpha(r as number)).toBe('painted')
    expect(r).toBe(Math.round(ALPHA.painted * 255))
  })

  it('the glowing code survives the forward pass to the post chain', async () => {
    const { pixels } = await drawWith({
      wall: { distance: 4, code: ALPHA.glowing },
      finish: false,
      probe: 'alpha',
    })
    const [r] = region(pixels, 80, 45, 1, 1)[0] as number[]
    expect(r).toBe(224)
  })

  it('a material writing the glowing code keeps its colour', async () => {
    const plain = await drawWith({ wall: { distance: 4 }, finish: false, probe: 'raw' })
    const glowing = await drawWith({
      wall: { distance: 4, code: ALPHA.glowing },
      finish: false,
      probe: 'raw',
    })
    expect(region(glowing.pixels, 80, 45, 1, 1)).toEqual(region(plain.pixels, 80, 45, 1, 1))
  })

  it('a faded wall reads as world, and an undrawn pixel finishes as colour 0', async () => {
    const { pixels } = await drawWith({ wall: { distance: 4, alpha: 0.4 }, finish: false, probe: 'alpha' })
    const [r] = region(pixels, 80, 45, 1, 1)[0] as number[]
    expect(codeOfAlpha(r as number)).toBe('world')
    const empty = await drawWith({ probe: 'raw' })
    expect(region(empty.pixels, 80, 45, 1, 1)).toEqual([[0, 0, 0]])
  })
})

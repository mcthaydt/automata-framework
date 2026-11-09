// The tile material on a real WebGL2 context: it draws a tile's texel times the light and gain, a floor-like face from the floor's
// tile and a wall from the wall's, and hazes by the view depth past the focus, all as `worldTexel`'s rule says, without the
// snap (the snap's own parity is `snap.parity.test.ts`). Quads face the camera at known depths, so a pixel's depth and the cell
// it lies in are known. WebGPU is the GPU runner's.
import '#src/entries/no-eval.ts'
import { Box, Geometry3D, Mesh3D, PostEffect, Vector3 } from '@pixi/3d'
import { UniformGroup } from 'pixi.js'
import { afterEach, describe, expect, it } from 'vitest'
import { createPixi3dRenderer } from '#src/app/create-renderer.ts'
import { DEFAULT_LOOK } from '#src/features/look/look.ts'
import { markFloor, TileMaterial } from '#src/features/look/tile-material.ts'
import type { TileImage } from '#src/features/photo/tile-store.ts'
import { DUEL } from '#src/shared/math/duel.ts'
import { hazeShare } from '#src/shared/render/texel.ts'
import { builtRenderer } from '#src/testing/built-renderer.ts'
import { snapshot } from '#src/testing/snapshot.ts'
import { testTarget } from '#src/testing/test-target.ts'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null
const frame = { alpha: 1, frameMs: 16, paused: false }
const W = 160
const H = 90

/** A 4 × 4 tile of sixteen distinct colours, `base` apart a cell, one texel a cell a metre. */
function tileOf(base: readonly [number, number, number]): TileImage {
  const rgba = new Uint8Array(4 * 4 * 4)
  for (let i = 0; i < 16; i++) rgba.set([base[0] + i * 8, base[1] + i * 6, base[2] + i * 4, 255], i * 4)
  return { width: 4, height: 4, rgba, labels: new Uint16Array(16), texels: [1, 1], offset: [0, 0] }
}
const FLOOR = tileOf([20, 60, 100])
const WALL = tileOf([120, 40, 20])

/** The colours of a tile, as bytes. */
const colours = (tile: TileImage): Set<number> =>
  new Set(
    Array.from({ length: 16 }, (_, i) => {
      const b = tile.rgba.subarray(i * 4, i * 4 + 4)
      return ((b[0] ?? 0) << 16) | ((b[1] ?? 0) << 8) | (b[2] ?? 0)
    }),
  )

/** A quad facing the camera at depth `z`, `width` by `height` metres around (x, 0), its metres read 0..4 across. */
function quad(
  x: number,
  z: number,
  floor: boolean,
  material: TileMaterial,
  light?: readonly [number, number, number],
): Mesh3D {
  const half = 1.2
  const geometry = new Geometry3D({
    positions: new Float32Array([-half, -half, 0, half, -half, 0, half, half, 0, -half, half, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
    uvs: new Float32Array([0, 0, 4, 0, 4, 4, 0, 4]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    bounds3D: new Box(new Vector3(-half, -half, 0), new Vector3(half, half, 0)),
    ...(light === undefined
      ? {}
      : { colors: new Float32Array(Array.from({ length: 4 }, () => [...light, 1]).flat()) }),
  })
  if (light !== undefined) material.vertexColors = true
  markFloor(geometry, floor ? [1, 1, 1, 1] : [0, 0, 0, 0])
  const mesh = new Mesh3D({ geometry, material })
  mesh.position.set(x, 0, z)
  return mesh
}

/** A pass that shows the alpha the scene wrote as a grey, since the canvas itself holds no alpha to read. */
class ShowAlpha extends PostEffect {
  protected override readonly fragment = {
    gl: 'vec4 effect(vec2 uv) { float a = sampleColor(uv).a; return vec4(a, a, a, 1.0); }',
    gpu: 'fn effect(uv: vec2<f32>) -> vec4<f32> { let a = sampleColor(uv).a; return vec4<f32>(a, a, a, 1.0); }',
  }
  protected override readonly uniforms = new UniformGroup({ uUnused: { value: 0, type: 'f32' } })
}

let scope: { dispose(): void } | undefined
afterEach(() => {
  scope?.dispose()
  scope = undefined
  document.body.replaceChildren()
})

async function draw(build: () => Mesh3D[], alpha = false): Promise<Uint8ClampedArray | Uint8Array> {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const factory = createPixi3dRenderer({
    logicalWidth: W,
    logicalHeight: H,
    backgroundColor: 0x000000,
    views: {},
    scene: (view) => {
      view.camera.position.set(0, 0, 10)
      view.camera.lookAt({ x: 0, y: 0, z: 0 })
      for (const mesh of build()) view.root.addChild(mesh)
      if (alpha) view.passes = [new ShowAlpha()]
      return undefined
    },
  })
  const renderer = await builtRenderer(factory(testTarget(host, {}, { width: W, height: H })))
  scope = renderer
  renderer.draw(frame)
  renderer.draw(frame)
  return snapshot(renderer)
}

const options = (extra: object = {}) =>
  ({ colour: 0x808080, haze: { ...DEFAULT_LOOK.haze, amount: 0 }, gain: 1, ...extra }) as const

/** The colours (as 0xRRGGBB) of the pixels in a column band of the picture that are not the background (the stage's bars, top and bottom, are left out). */
function seen(pixels: ArrayLike<number>, x0: number, x1: number): Set<number> {
  const found = new Set<number>()
  for (let y = 10; y < H - 10; y++)
    for (let x = x0; x < x1; x++) {
      const o = (y * W + x) * 4
      const c = ((pixels[o] ?? 0) << 16) | ((pixels[o + 1] ?? 0) << 8) | (pixels[o + 2] ?? 0)
      if (c !== 0) found.add(c)
    }
  return found
}

describe.runIf(hasWebGL2)('the tile material on WebGL2', () => {
  it('draws a floor-like face from the floor’s tile and a wall from the wall’s, texel for texel', async () => {
    const pixels = await draw(() => [
      quad(-1.5, 0, true, new TileMaterial(options({ floor: FLOOR, wall: WALL }))),
      quad(1.5, 0, false, new TileMaterial(options({ floor: FLOOR, wall: WALL }))),
    ])
    const left = seen(pixels, 0, W / 2)
    const right = seen(pixels, W / 2, W)
    expect([...left].every((c) => colours(FLOOR).has(c))).toBe(true)
    expect([...right].every((c) => colours(WALL).has(c))).toBe(true)
    // Each cell of the tile shows: a metre of tile is a quarter of the quad.
    expect(left.size).toBe(16)
    expect(right.size).toBe(16)
  })

  it('multiplies by the light in the vertex colours and the gain, clamped to 1', async () => {
    const material = new TileMaterial(options({ floor: FLOOR, gain: 2 }))
    const mesh = quad(0, 0, true, material)
    const pixels = await draw(() => [mesh])
    const want = new Set(
      [...colours(FLOOR)].map((c) => {
        const k = (v: number): number => Math.min(255, Math.round((v / 255) * 2 * 255))
        return (k((c >> 16) & 255) << 16) | (k((c >> 8) & 255) << 8) | k(c & 255)
      }),
    )
    const got = seen(pixels, 0, W)
    // The brightest cells clamp to the same colour, and no two others do.
    expect(got.size).toBe(want.size)
    for (const c of got) {
      const near = [...want].some(
        (w) =>
          Math.abs(((w >> 16) & 255) - ((c >> 16) & 255)) <= 1 &&
          Math.abs(((w >> 8) & 255) - ((c >> 8) & 255)) <= 1 &&
          Math.abs((w & 255) - (c & 255)) <= 1,
      )
      expect(near).toBe(true)
    }
  })

  it('hazes by the view depth past the focus', async () => {
    const haze = { colour: '#47655a', near: 0, far: 10, amount: 0.85, glow: 0.5 }
    const flatTile: TileImage = {
      width: 1,
      height: 1,
      rgba: new Uint8Array([200, 120, 40, 255]),
      labels: new Uint16Array(1),
      texels: [1, 1],
      offset: [0, 0],
    }
    const material = (): TileMaterial => {
      const m = new TileMaterial({ colour: 0x808080, floor: flatTile, haze, gain: 1 })
      m.focus = 2
      return m
    }
    // Depth 5 and 8 from the camera at z = 10: 3 and 6 metres past the focus.
    const pixels = await draw(() => [quad(-1.5, 5, true, material()), quad(1.5, 2, true, material())])
    const lone = (x0: number, x1: number): number => [...seen(pixels, x0, x1)][0] ?? 0
    const expectShare = (depth: number): [number, number, number] => {
      const share = hazeShare(depth - 2, haze)
      const veil = [0x47, 0x65, 0x5a].map((v) => v / 255)
      const own = [200, 120, 40].map((v) => v / 255)
      return own.map((v, i) => v + (Math.min(1, (veil[i] ?? 0) + 0.5 * 1) - v) * share) as [
        number,
        number,
        number,
      ]
    }
    for (const [x0, x1, depth] of [
      [0, W / 2, 5],
      [W / 2, W, 8],
    ] as const) {
      const c = lone(x0, x1)
      const want = expectShare(depth)
      const got = [(c >> 16) & 255, (c >> 8) & 255, c & 255]
      got.forEach((v, i) => {
        expect(Math.abs(v - (want[i] ?? 0) * 255)).toBeLessThanOrEqual(1.5)
      })
    }
  })

  it('draws a DUEL colour at full light with no haze byte for byte', async () => {
    const duelTile: TileImage = {
      width: 4,
      height: 4,
      rgba: Uint8Array.from(
        DUEL.slice(40, 56).flatMap((d) => [(d.c >> 16) & 255, (d.c >> 8) & 255, d.c & 255, 255]),
      ),
      labels: new Uint16Array(16),
      texels: [1, 1],
      offset: [0, 0],
    }
    const pixels = await draw(() => [quad(0, 0, true, new TileMaterial(options({ floor: duelTile })))])
    expect([...seen(pixels, 0, W)].sort()).toEqual(
      DUEL.slice(40, 56)
        .map((d) => d.c)
        .sort(),
    )
  })

  it('an emissive swatch writes the glowing code and keeps its colour in no light', async () => {
    const dark = new TileMaterial(options({ floor: FLOOR, glowing: true }))
    // A glowing piece's baked light is not read: its vertex colours are black here, and it still shows its tile.
    const mesh = quad(0, 0, true, dark)
    const at = ((H / 2) * W + W / 2) * 4
    expect((await draw(() => [mesh], true))[at]).toBe(224)
    const shown = await draw(() => [
      quad(0, 0, true, new TileMaterial(options({ floor: FLOOR, glowing: true }))),
    ])
    expect([...seen(shown, 0, W)].every((c) => colours(FLOOR).has(c))).toBe(true)
  })

  it('a faded tile piece blends over what is behind it and the pixel is still a world pixel', async () => {
    const front = new TileMaterial(options({ floor: WALL, alphaMode: 'blend', alpha: 0.5 }))
    const pixels = await draw(() => [
      quad(0, 0, true, new TileMaterial(options({ floor: FLOOR }))),
      quad(0, 2, true, front),
    ])
    const at = ((H / 2) * W + W / 2) * 4
    const grey = await draw(
      () => [
        quad(0, 0, true, new TileMaterial(options({ floor: FLOOR }))),
        quad(0, 2, true, new TileMaterial(options({ floor: WALL, alphaMode: 'blend', alpha: 0.5 }))),
      ],
      true,
    )
    expect(grey[at]).toBe(255)
    // Both quads are in front of one another's cells; the blend lies between the two tiles' colours on every channel.
    const behind = [...colours(FLOOR)].flatMap((c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255])
    const infront = [...colours(WALL)].flatMap((c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255])
    const lo = Math.min(...behind, ...infront)
    const hi = Math.max(...behind, ...infront)
    for (let i = 0; i < 3; i++) {
      expect(pixels[at + i]).toBeGreaterThanOrEqual(lo)
      expect(pixels[at + i]).toBeLessThanOrEqual(hi)
    }
    // And it is not one tile's colour alone.
    const got = ((pixels[at] ?? 0) << 16) | ((pixels[at + 1] ?? 0) << 8) | (pixels[at + 2] ?? 0)
    expect(colours(FLOOR).has(got) || colours(WALL).has(got)).toBe(false)
  })

  it('takes the light from the vertex colours, a channel at a time, over 1 as well', async () => {
    const light = [0.5, 1.25, 0.2] as const
    const pixels = await draw(() => [quad(0, 0, true, new TileMaterial(options({ floor: FLOOR })), light)])
    const want = [...colours(FLOOR)].map((c) =>
      [(c >> 16) & 255, (c >> 8) & 255, c & 255].map((v, i) =>
        Math.min(255, Math.round(v * (light[i] ?? 1))),
      ),
    )
    const got = [...seen(pixels, 0, W)].map((c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255])
    expect(got).toHaveLength(16)
    for (const g of got)
      expect(want.some((w) => w.every((v, i) => Math.abs(v - (g[i] ?? 0)) <= 1))).toBe(true)
  })
})

// Painted figures in the frame on a real WebGL2 context: a cell lands on whole field pixels with its colours unchanged,
// the nearer figure's texels win, a table hides a figure's legs. The snap and the finish are stubs here, as in the
// composite pass's test (the look's own come with the look); WebGPU is the GPU runner's.
import '#src/entries/no-eval.ts'
import { fakeClock } from '@automata/framework/testing'
import { CubeGeometry, FlatMaterial, Mesh3D, PostEffect } from '@pixi/3d'
import { UniformGroup } from 'pixi.js'
import { afterEach, describe, expect, it } from 'vitest'
import { commands } from 'vitest/browser'
import { createPixi3dRenderer } from '#src/app/create-renderer.ts'
import { CellCache } from '#src/features/figures/cells/cell-cache.ts'
import {
  createFigureLayer,
  type FigureLayer,
  type LayerFigure,
} from '#src/features/figures/layer/figure-layer.ts'
import type { PaintedCell } from '#src/features/figures/paint/paint-cell.ts'
import { figure } from '#src/features/figures/view/figure-view.ts'
import { DEFAULT_LOOK } from '#src/features/look/look.ts'
import { CONTEXT_RESTORE_MS } from '#src/features/renderer/context-loss.ts'
import { alphaCodeGlsl, alphaCodeWgsl } from '#src/shared/render/alpha/alpha-codes.ts'
import { createSceneLight } from '#src/shared/render/light/scene-light.ts'
import { sceneLightingSchema } from '#src/shared/render/light/scene-lighting.schema.ts'
import { builtRenderer } from '#src/testing/built-renderer.ts'
import { snapshot } from '#src/testing/snapshot.ts'
import { testTarget } from '#src/testing/test-target.ts'
import type { WickFixture } from '../../../../../vitest.config.ts'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null
const frame = { alpha: 1, frameMs: 16, paused: false }

class Stub extends PostEffect {
  protected override readonly fragment: { gpu: string; gl: string }
  protected override readonly uniforms = new UniformGroup({ uUnused: { value: 0, type: 'f32' } })
  constructor(gl: string, gpu: string) {
    super()
    this.fragment = { gl: `${alphaCodeGlsl()}\n${gl}`, gpu: `${alphaCodeWgsl()}\n${gpu}` }
  }
}
/** The finish: alpha 1 where anything was drawn, colour 0 where nothing was. */
const finishStub = (): Stub =>
  new Stub(
    `vec4 effect(vec2 uv) { vec4 c = sampleColor(uv); if (isDrawn(c.a)) return vec4(c.rgb, 1.0); return vec4(0.0); }`,
    `fn effect(uv: vec2<f32>) -> vec4<f32> { let c = sampleColor(uv); if (isDrawn(c.a)) { return vec4<f32>(c.rgb, 1.0); } return vec4<f32>(0.0); }`,
  )

/** A cell of 4 × 4 blocks of `colours` by row, opaque everywhere, flat in depth, its feet where the painter's are. */
function stripedCell(colours: readonly number[], width = 64, height = 96): PaintedCell {
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const c = colours[(y >> 2) % colours.length] ?? 0
      pixels.set([c >> 16, (c >> 8) & 255, c & 255, 255], (y * width + x) * 4)
    }
  return {
    width,
    height,
    feet: [width / 2, height - 13.5],
    colours: pixels,
    normals: new Uint8ClampedArray(width * height * 4),
    depth: new Float32Array(width * height),
    material: new Int16Array(width * height),
  }
}

/** A figure that is always the same cell, standing at `at`. */
function still(
  cell: PaintedCell,
  at: readonly [number, number, number],
  key = 'still',
): LayerFigure & { asked: number[] } {
  const asked: number[] = []
  return {
    asked,
    place: () => ({ at, yaw: 0 }),
    cell: (view) => {
      asked.push(view.density)
      return { key, cell }
    },
  }
}

interface Draw {
  readonly size?: readonly [number, number]
  readonly figures?: readonly LayerFigure[]
  /** A table across the whole view: its top at `top` metres, `z` metres from the origin toward the camera. */
  readonly table?: { readonly top: number; readonly z: number }
  /** A grey floor under the origin, a lamp straight over it, and the camera 2 m up: shadows fall on it. */
  readonly floor?: boolean
  /** The field pixel of a floor point, read out once the scene is up. */
  readonly probe?: readonly [number, number, number]
}

let scope: { dispose(): void } | undefined
afterEach(() => {
  scope?.dispose()
  scope = undefined
  document.body.replaceChildren()
})

async function drawFigures(
  options: Draw,
): Promise<{ pixels: Uint8ClampedArray | Uint8Array; width: number; probed?: { x: number; y: number } }> {
  const [width, height] = options.size ?? [320, 180]
  let probed: { x: number; y: number } | undefined
  const host = document.createElement('div')
  document.body.appendChild(host)
  let layer: FigureLayer | undefined
  const factory = createPixi3dRenderer({
    logicalWidth: width,
    logicalHeight: height,
    backgroundColor: 0x000000,
    views: {},
    scene: (view) => {
      view.camera.position.set(0, options.floor ? 2 : 0, 5)
      view.camera.lookAt({ x: 0, y: 0, z: 0 })
      if (options.floor) {
        const floor = new Mesh3D({
          geometry: new CubeGeometry(),
          material: new FlatMaterial({ baseColor: 0x808080 }),
        })
        floor.scale.set(20, 0.05, 20)
        floor.position.set(0, -0.05, 0)
        view.root.addChild(floor)
      }
      const speck = new Mesh3D({
        geometry: new CubeGeometry(),
        material: new FlatMaterial({ baseColor: 0x000000 }),
      })
      speck.position.set(500, 0, -500)
      view.root.addChild(speck)
      if (options.table) {
        const table = new Mesh3D({
          geometry: new CubeGeometry(),
          material: new FlatMaterial({ baseColor: 0xf9c22b }),
        })
        table.scale.set(40, 2, 0.1)
        table.position.set(0, options.table.top - 1, options.table.z)
        view.root.addChild(table)
      }
      const light = options.floor
        ? createSceneLight(
            sceneLightingSchema.parse({
              ambient: 0.5,
              lamps: [{ id: 'lamp', x: 0, y: 3, z: 0, color: 0xffffff, range: 9 }],
            }),
          )
        : undefined
      layer = createFigureLayer(view, DEFAULT_LOOK, light)
      layer.setFocus(5)
      for (const f of options.figures ?? []) layer.add(f)
      view.passes = [layer.pass, finishStub()]
      if (options.probe) {
        const [x, y, z] = options.probe
        view.camera.getGlobalTransform()
        probed = view.worldToScreen({ x, y, z }) ?? undefined
      }
      return { draw: () => layer?.frame() }
    },
  })
  const renderer = await builtRenderer(factory(testTarget(host, {}, { width, height })))
  scope = { dispose: () => (renderer.dispose(), layer?.dispose()) }
  renderer.draw(frame)
  renderer.draw(frame)
  return { pixels: snapshot(renderer), width, ...(probed === undefined ? {} : { probed }) }
}

const rgbAt = (pixels: ArrayLike<number>, width: number, x: number, y: number): number => {
  const o = (y * width + x) * 4
  return ((pixels[o] ?? 0) << 16) | ((pixels[o + 1] ?? 0) << 8) | (pixels[o + 2] ?? 0)
}
const BLOCKS = [0x2a2c3f, 0x7e5c4b, 0xb4a07c, 0x48724e]

describe.runIf(hasWebGL2)('painted figures in the frame on WebGL2', () => {
  it('draws a figure on whole pixels, its colours unchanged, its feet where its root projects', async () => {
    const cell = stripedCell(BLOCKS)
    // The root is half a pixel right of and below the middle of the 320 × 180 field (31.2 pixels a metre at 5 m), so it
    // lands on pixel (160, 90), and the feet texel (32, 82) is there.
    const half = 0.5 / 31.1769
    const { pixels, width } = await drawFigures({ figures: [still(cell, [half, -half, 0])] })
    const x0 = 160 - 32
    const y0 = 90 - 82
    // The stage's bars cover the field's top and bottom rows, so the corners that matter are the lower ones.
    for (const [dx, dy] of [
      [0, 4],
      [63, 4],
      [0, 95],
      [63, 95],
      [31, 50],
      [40, 17],
    ] as const)
      expect(rgbAt(pixels, width, x0 + dx, y0 + dy), `texel ${dx},${dy}`).toBe(
        BLOCKS[(dy >> 2) % BLOCKS.length],
      )
    // Nothing is drawn a pixel outside the cell.
    expect(rgbAt(pixels, width, x0 - 1, y0 + 40)).toBe(0)
    expect(rgbAt(pixels, width, x0 + 64, y0 + 40)).toBe(0)
    expect(rgbAt(pixels, width, x0 + 20, y0 + 96)).toBe(0)
  })

  it('the nearer figure’s texels win where two overlap, wherever they were drawn first', async () => {
    const far = stripedCell([0x2a2c3f])
    const near = stripedCell([0xb4a07c])
    for (const order of [
      [0, 1],
      [1, 0],
    ] as const) {
      const figures = order.map((i) =>
        i === 0 ? still(far, [0, 0, 0], 'far') : still(near, [0.3, 0, 2], 'near'),
      )
      const { pixels, width } = await drawFigures({ figures })
      scope?.dispose()
      // 0.3 m at 3 m from the camera is 18 pixels to the right of the far figure's root.
      expect(rgbAt(pixels, width, 170, 60)).toBe(0xb4a07c)
      expect(rgbAt(pixels, width, 135, 60)).toBe(0x2a2c3f)
    }
  })

  it('a table hides a figure’s legs and not the rest of him', async () => {
    const cell = stripedCell(BLOCKS)
    const bare = await drawFigures({ figures: [still(cell, [0, 0, 0])] })
    scope?.dispose()
    const table = await drawFigures({ figures: [still(cell, [0, 0, 0])], table: { top: 0.33, z: 2 } })
    const x = 160
    // Above the table's top (screen row 70 at 60 pixels a metre) the figure is as it was; below it the table is.
    expect(rgbAt(table.pixels, table.width, x, 40)).toBe(rgbAt(bare.pixels, bare.width, x, 40))
    expect(rgbAt(table.pixels, table.width, x, 85)).not.toBe(rgbAt(bare.pixels, bare.width, x, 85))
    expect(rgbAt(table.pixels, table.width, x, 85)).not.toBe(0)
  })

  it('an upright phone field draws a figure on whole pixels at the density its view asks for', async () => {
    const cell = stripedCell(BLOCKS, 192, 288)
    const figureAt = still(cell, [0, 0, 0])
    const { pixels, width } = await drawFigures({ size: [360, 779], figures: [figureAt] })
    expect(figureAt.asked.every((d) => d === figureAt.asked[0])).toBe(true)
    const x0 = 180 - 96
    const y0 = 389 - 274
    expect(rgbAt(pixels, width, x0, y0 + 100)).toBe(BLOCKS[(100 >> 2) % BLOCKS.length])
    expect(rgbAt(pixels, width, x0 + 191, y0 + 100)).toBe(BLOCKS[(100 >> 2) % BLOCKS.length])
  })

  it('a layer’s cache holds what the frame shows', () => {
    const cache = new CellCache(1)
    cache.put('a', stripedCell(BLOCKS))
    cache.hold(['a'])
    cache.put('b', stripedCell(BLOCKS))
    expect(cache.get('a')).toBeDefined()
  })
})

describe.runIf(hasWebGL2)('a figure’s shadow on the floor', () => {
  /** A cell only a thin column of which is drawn, so the floor beside it shows. */
  const post = (): PaintedCell => {
    const cell = stripedCell([0x2a2c3f])
    for (let y = 0; y < cell.height; y++)
      for (let x = 0; x < cell.width; x++)
        if (Math.abs(x - 32) > 1) cell.colours[(y * cell.width + x) * 4 + 3] = 0
    return cell
  }

  it('darkens the floor under the feet by the look’s shadow factor, and only there', async () => {
    const under = [0.15, 0, 0.05] as const
    const away = [2.5, 0, 0.05] as const
    const bare = await drawFigures({ floor: true, probe: under })
    scope?.dispose()
    const shadowed = await drawFigures({ floor: true, probe: under, figures: [still(post(), [0, 0, 0])] })
    const [x, y] = [Math.floor(shadowed.probed?.x ?? 0), Math.floor(shadowed.probed?.y ?? 0)]
    const was = rgbAt(bare.pixels, bare.width, x, y) & 255
    const now = rgbAt(shadowed.pixels, shadowed.width, x, y) & 255
    expect(was).toBeGreaterThan(40)
    expect(now / was).toBeCloseTo(DEFAULT_LOOK.figureShadow, 1)
    scope?.dispose()
    const far = await drawFigures({ floor: true, probe: away, figures: [still(post(), [0, 0, 0])] })
    const [fx, fy] = [Math.floor(far.probed?.x ?? 0), Math.floor(far.probed?.y ?? 0)]
    expect(rgbAt(far.pixels, far.width, fx, fy) & 255).toBe(was)
  })
})

describe.runIf(hasWebGL2)('Wick through the renderer', () => {
  it('stands in the frame once painted, and nowhere else', async () => {
    const wick = (commands as unknown as { wickFixture: () => Promise<WickFixture> }).wickFixture
    const fixture = await wick()
    const host = document.createElement('div')
    document.body.appendChild(host)
    const row = { sid: 1, components: { hero: { x: 0, y: 0, z: 0, yaw: Math.PI } } }
    const make = (empty: boolean) =>
      builtRenderer(
        createPixi3dRenderer({
          logicalWidth: 320,
          logicalHeight: 180,
          backgroundColor: 0x000000,
          look: DEFAULT_LOOK,
          views: {
            hero: figure(fixture.wick, { library: fixture.library, motion: fixture.motion, now: () => 0 }),
          },
          scene: (view) => {
            view.camera.position.set(0, 1, 5)
            view.camera.lookAt({ x: 0, y: 1, z: 0 })
            const speck = new Mesh3D({
              geometry: new CubeGeometry(),
              material: new FlatMaterial({ baseColor: 0x000000 }),
            })
            speck.position.set(500, 0, -500)
            view.root.addChild(speck)
            return undefined
          },
        })(testTarget(host, {}, { width: 320, height: 180 })),
      ).then((r) => {
        if (!empty)
          r.apply({
            tick: 1,
            events: [],
            rejected: [],
            render: { resync: true, added: [row], changed: [], removed: [] },
          })
        return r
      })
    const empty = await make(true)
    empty.draw(frame)
    const emptyPixels = Uint8ClampedArray.from(snapshot(empty))
    empty.dispose()
    const drawn = await make(false)
    scope = drawn
    for (let i = 0; i < 4; i++) drawn.draw(frame)
    const pixels = snapshot(drawn)
    let changed = 0
    let outside = 0
    for (let y = 0; y < 180; y++)
      for (let x = 0; x < 320; x++) {
        if (rgbAt(pixels, 320, x, y) === rgbAt(emptyPixels, 320, x, y)) continue
        changed++
        if (x < 160 - 40 || x > 160 + 40 || y < 4 || y > 176) outside++
      }
    expect(changed).toBeGreaterThan(500)
    expect(outside).toBe(0)
  })

  it('draws him again after Try again builds a new renderer on a new context', async () => {
    const wick = (commands as unknown as { wickFixture: () => Promise<WickFixture> }).wickFixture
    const fixture = await wick()
    const host = document.createElement('div')
    document.body.appendChild(host)
    const row = { sid: 1, components: { hero: { x: 0, y: 0, z: 0, yaw: Math.PI } } }
    const clock = fakeClock()
    const target = testTarget(host, {}, { width: 320, height: 180 })
    const built = await builtRenderer(
      createPixi3dRenderer({
        logicalWidth: 320,
        logicalHeight: 180,
        backgroundColor: 0x000000,
        look: DEFAULT_LOOK,
        clock,
        views: {
          hero: figure(fixture.wick, { library: fixture.library, motion: fixture.motion, now: () => 0 }),
        },
        scene: (view) => {
          view.camera.position.set(0, 1, 5)
          view.camera.lookAt({ x: 0, y: 1, z: 0 })
          return undefined
        },
      })(target),
    )
    scope = built
    built.apply({
      tick: 1,
      events: [],
      rejected: [],
      render: { resync: true, added: [row], changed: [], removed: [] },
    })
    for (let i = 0; i < 4; i++) built.draw(frame)
    const before = Uint8ClampedArray.from(snapshot(built))
    const oldCanvas = built.stage.app.canvas
    const gl = (built.stage.app.renderer as unknown as { gl: WebGL2RenderingContext }).gl
    const lost = new Promise((resolve) =>
      oldCanvas.addEventListener('webglcontextlost', resolve, { once: true }),
    )
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    await lost
    clock.advance(CONTEXT_RESTORE_MS)
    await expect.poll(() => target.lostPanels.length).toBe(1)
    target.lostPanels[0]?.()
    await expect.poll(() => built.stage.app.canvas !== oldCanvas && !oldCanvas.isConnected).toBe(true)
    for (let i = 0; i < 4; i++) built.draw(frame)
    const after = snapshot(built)
    let same = 0
    let drawn = 0
    for (let i = 0; i < before.length; i += 4) {
      const was = (before[i] ?? 0) | (before[i + 1] ?? 0) | (before[i + 2] ?? 0)
      if (was === 0) continue
      drawn++
      if (before[i] === after[i] && before[i + 1] === after[i + 1] && before[i + 2] === after[i + 2]) same++
    }
    expect(drawn).toBeGreaterThan(500)
    expect(same / drawn).toBeGreaterThan(0.97)
  })
})

// The 3D renderer on a real context in each engine (M3.4a). Headless Firefox in this container has no WebGL at all,
// so there the drawing cases skip and the refusal case runs instead; the GPU runner runs them all (M3.1b).
import '../no-eval.js'
import type { RenderRow, StepResult } from '@mcthaydt/automata-sim'
import { DirectionalLight } from '@pixi/3d'
import { Effect, Exit, ManagedRuntime, Scope, TestClock, TestContext } from 'effect'
import { RenderTexture } from 'pixi.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { encodeGlb, fixtureBox, fixtureQuad } from '../model/testing/model-fixtures.js'
import { CONTEXT_RESTORE_MS } from '../renderer/context-loss.js'
import { createPixi3dRenderer, type Pixi3dRenderer } from '../renderer/create-pixi3d-renderer.js'
import { testTarget } from '../testing/test-target.js'
import { box } from '../views/box-view.js'
import { mesh } from '../views/mesh-view.js'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null
const BACKGROUND = 0x2e222f
const frame = { alpha: 1, frameMs: 16, paused: false }
const step = (render: StepResult['render']): StepResult => ({ tick: 0, events: [], render, rejected: [] })
const rows: RenderRow[] = [
  { sid: 1, components: { crate: { x: -1, y: 0, z: 0 } } },
  { sid: 2, components: { prop: { x: 1, y: 0, z: 0 } } },
]

let scope: Scope.CloseableScope | undefined
afterEach(async () => {
  if (scope) await Effect.runPromise(Scope.close(scope, Exit.void))
  scope = undefined
  document.body.replaceChildren()
})

const makeViews = () => ({
  crate: box({ width: 1, height: 1, depth: 1 }, { color: 0xf9c22b }),
  prop: mesh('models/box.glb', { height: 1 }),
})

async function start(
  views: ReturnType<typeof makeViews> = makeViews(),
  run: <A, E>(effect: Effect.Effect<A, E>) => Promise<A> = Effect.runPromise,
): Promise<{ renderer: Pixi3dRenderer; target: ReturnType<typeof testTarget> }> {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const target = testTarget(host, { 'models/box.glb': encodeGlb(fixtureBox()) })
  const factory = createPixi3dRenderer({
    logicalWidth: 160,
    logicalHeight: 90,
    backgroundColor: BACKGROUND,
    views,
    scene: (view) => {
      view.camera.position.set(0, 2.5, 5)
      view.camera.lookAt({ x: 0, y: 0.5, z: 0 })
      const sun = new DirectionalLight({ intensity: 2 })
      sun.rotation.set(-0.8, 0.5, 0)
      view.root.addChild(sun)
      return undefined
    },
  })
  scope = Effect.runSync(Scope.make())
  const renderer = await run(Scope.extend(factory(target), scope))
  return { renderer, target }
}

/** The whole stage's pixels, rendered into a texture. */
function snapshot(renderer: Pixi3dRenderer): Uint8ClampedArray | Uint8Array {
  const { app } = renderer.stage
  const texture = RenderTexture.create({ width: app.screen.width, height: app.screen.height, resolution: 1 })
  app.renderer.render({ container: app.stage, target: texture, clear: true })
  const { pixels } = app.renderer.extract.pixels(texture)
  texture.destroy(true)
  return pixels
}

/** How many pixels differ between two snapshots by more than a rounding step. */
function differing(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let count = 0
  for (let i = 0; i < a.length; i += 4)
    if (
      Math.abs((a[i] ?? 0) - (b[i] ?? 0)) +
        Math.abs((a[i + 1] ?? 0) - (b[i + 1] ?? 0)) +
        Math.abs((a[i + 2] ?? 0) - (b[i + 2] ?? 0)) >
      6
    )
      count++
  return count
}

const nextEvent = (canvas: HTMLCanvasElement, name: string) =>
  new Promise<void>((resolve) => canvas.addEventListener(name, () => resolve(), { once: true }))

describe.runIf(hasWebGL2)('createPixi3dRenderer on WebGL2', () => {
  it('mounts the View3D in stage.world and draws a box and a mesh', async () => {
    const { renderer } = await start()
    expect(renderer.view.parent).toBe(renderer.stage.world)
    expect(renderer.stage.app.renderer.name).toBe('webgl')
    renderer.draw(frame)
    const empty = snapshot(renderer)

    renderer.apply(step({ resync: true, added: rows, changed: [], removed: [] }))
    renderer.draw(frame)
    // The box and the mesh cover a few hundred of the 160 × 90 field's pixels.
    expect(differing(empty, snapshot(renderer))).toBeGreaterThan(200)
  })

  // Review of #241: a renderer's scope frees its models, and the same views (a box() factory's shared geometry and
  // material) draw again in the next renderer, as after Try again or a restart.
  it('draws the same views again in a second renderer after the first one closed', async () => {
    const views = makeViews()
    for (let lifetime = 0; lifetime < 2; lifetime++) {
      const { renderer } = await start(views)
      renderer.draw(frame)
      const empty = snapshot(renderer)
      renderer.apply(step({ resync: true, added: rows, changed: [], removed: [] }))
      renderer.draw(frame)
      expect(differing(empty, snapshot(renderer)), `lifetime ${lifetime}`).toBeGreaterThan(200)
      if (scope) await Effect.runPromise(Scope.close(scope, Exit.void))
      scope = undefined
      document.body.replaceChildren()
    }
  })

  it('adds, moves (interpolated) and removes views over the Container3D root', async () => {
    const { renderer } = await start()
    const root = renderer.view.root
    const before = root.children.length
    renderer.apply(step({ resync: true, added: rows, changed: [], removed: [] }))
    expect(root.children.length).toBe(before + 2)
    const crate = root.children[before]
    renderer.apply(
      step({
        resync: false,
        added: [],
        changed: [{ sid: 1, components: { crate: { x: 1, y: 0, z: 2 } } }],
        removed: [],
      }),
    )
    renderer.draw({ ...frame, alpha: 0.5 })
    expect([crate?.position.x, crate?.position.z]).toEqual([0, 1])
    renderer.apply(step({ resync: false, added: [], changed: [], removed: [1, 2] }))
    expect(root.children.length).toBe(before)
  })

  it('recovers from a lost context: draws nothing while lost, then the scene again', async () => {
    const { renderer, target } = await start()
    renderer.draw(frame)
    const empty = snapshot(renderer)
    renderer.apply(step({ resync: true, added: rows, changed: [], removed: [] }))
    renderer.draw(frame)
    const scene = snapshot(renderer)
    const canvas = renderer.stage.app.canvas
    const gl = (renderer.stage.app.renderer as unknown as { gl: WebGL2RenderingContext }).gl
    const lose = gl.getExtension('WEBGL_lose_context')
    if (lose === null) throw new Error('no WEBGL_lose_context')

    const lost = nextEvent(canvas, 'webglcontextlost')
    lose.loseContext()
    await lost
    const render = vi.spyOn(renderer.stage.app, 'render')
    renderer.draw(frame)
    expect(render).not.toHaveBeenCalled()
    expect(target.facts.map((f) => f.name)).toContain('render.context.lost')

    // The browser takes a restore only after the lost event's task has finished.
    await new Promise((resolve) => setTimeout(resolve, 20))
    const restored = nextEvent(canvas, 'webglcontextrestored')
    lose.restoreContext()
    await restored
    renderer.draw(frame)
    expect(render).toHaveBeenCalledOnce()
    render.mockRestore()
    expect(target.facts.map((f) => f.name)).toContain('render.context.restored')
    const back = snapshot(renderer)
    expect(differing(empty, back)).toBeGreaterThan(200)
    expect(differing(scene, back)).toBe(0)
  })
})

// M3 spec §5, review of #241: a context the browser never gives back asks for the panel after the wait (on a test
// clock), and Try again builds a new app on a new context and draws the same scene from the sim's rows.
describe.runIf(hasWebGL2)('a context that does not come back', () => {
  it('asks for the panel after the wait, and Try again draws the scene on a new context', async () => {
    const clock = ManagedRuntime.make(TestContext.TestContext)
    const { renderer, target } = await start(makeViews(), (effect) => clock.runPromise(effect))
    renderer.draw(frame)
    const empty = snapshot(renderer)
    renderer.apply(step({ resync: true, added: rows, changed: [], removed: [] }))
    renderer.draw(frame)
    const oldCanvas = renderer.stage.app.canvas
    const gl = (renderer.stage.app.renderer as unknown as { gl: WebGL2RenderingContext }).gl
    const lost = nextEvent(oldCanvas, 'webglcontextlost')
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    await lost

    await clock.runPromise(TestClock.adjust(CONTEXT_RESTORE_MS - 1))
    expect(target.lostPanels).toHaveLength(0)
    await clock.runPromise(TestClock.adjust(1))
    await expect.poll(() => target.lostPanels.length).toBe(1)

    target.lostPanels[0]?.()
    await expect
      .poll(() => renderer.stage.app.canvas !== oldCanvas && oldCanvas.isConnected === false)
      .toBe(true)
    renderer.draw(frame)
    expect(differing(empty, snapshot(renderer))).toBeGreaterThan(200)
    expect(renderer.view.root.children.length).toBeGreaterThanOrEqual(2)
    await clock.dispose()
  })
})

describe.runIf(!hasWebGL2)('createPixi3dRenderer without WebGL2', () => {
  it("refuses Pixi's Canvas fallback with RendererUnavailable", async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    scope = Effect.runSync(Scope.make())
    const exit = await Effect.runPromiseExit(
      Scope.extend(createPixi3dRenderer({ views: {} })(testTarget(host)), scope),
    )
    expect(Exit.isFailure(exit) && JSON.stringify(exit.cause.toJSON())).toContain(
      '"_tag":"RendererUnavailable"',
    )
  })
})

/** A 2 × 2 PNG, top-left red, top-right green, bottom-left blue, bottom-right yellow. */
async function quadrantsPng(): Promise<Uint8Array> {
  const canvas = document.createElement('canvas')
  canvas.width = 2
  canvas.height = 2
  const context = canvas.getContext('2d')
  if (context === null) throw new Error('no 2D context')
  for (const [x, y, colour] of [
    [0, 0, '#ff0000'],
    [1, 0, '#00ff00'],
    [0, 1, '#0000ff'],
    [1, 1, '#ffff00'],
  ] as const) {
    context.fillStyle = colour
    context.fillRect(x, y, 1, 1)
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (blob === null) throw new Error('no PNG')
  return new Uint8Array(await blob.arrayBuffer())
}

// Review of #241: a direct texture check. The image must land the right way up and round (glTF's UV origin is the
// image's top-left), sampled nearest, as pixel art is, so each quadrant keeps its own colour.
describe.runIf(hasWebGL2)("a mesh's texture", () => {
  it('lands the right way up and round, sampled nearest', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const glb = encodeGlb(fixtureQuad(), { image: await quadrantsPng() })
    const factory = createPixi3dRenderer({
      logicalWidth: 160,
      logicalHeight: 90,
      views: { prop: mesh('models/quad.glb') },
      scene: (view) => {
        view.camera.position.set(0, 1, 4)
        view.camera.lookAt({ x: 0, y: 1, z: 0 })
        view.environment = { skyColor: 0xffffff, groundColor: 0xffffff }
        return undefined
      },
    })
    scope = Effect.runSync(Scope.make())
    const renderer = await Effect.runPromise(
      Scope.extend(factory(testTarget(host, { 'models/quad.glb': glb })), scope),
    )
    renderer.apply(
      step({
        resync: true,
        added: [{ sid: 1, components: { prop: { x: 0, y: 0, z: 0 } } }],
        changed: [],
        removed: [],
      }),
    )
    renderer.draw(frame)
    const pixels = snapshot(renderer)
    const width = renderer.stage.app.screen.width
    // Each quadrant's pixels by its dominant channels, then where its middle lies on screen.
    const kinds = { red: [0, 0, 0], green: [0, 0, 0], blue: [0, 0, 0], yellow: [0, 0, 0] } as Record<
      string,
      number[]
    >
    const colours = new Set<number>()
    for (let i = 0; i < pixels.length; i += 4) {
      const [r, g, b] = [pixels[i] ?? 0, pixels[i + 1] ?? 0, pixels[i + 2] ?? 0]
      const kind =
        r > 2 * b && g > 2 * b && r > 60 && g > 60
          ? 'yellow'
          : r > 2 * g && r > 2 * b && r > 60
            ? 'red'
            : g > 2 * r && g > 2 * b && g > 60
              ? 'green'
              : b > 2 * r && b > 2 * g && b > 60
                ? 'blue'
                : undefined
      if (kind === undefined) continue
      colours.add((r << 16) | (g << 8) | b)
      const sum = kinds[kind] as number[]
      sum[0] = (sum[0] ?? 0) + ((i / 4) % width)
      sum[1] = (sum[1] ?? 0) + Math.floor(i / 4 / width)
      sum[2] = (sum[2] ?? 0) + 1
    }
    const at = (kind: string) => {
      const [x = 0, y = 0, n = 0] = kinds[kind] as number[]
      expect(n, kind).toBeGreaterThan(20)
      return { x: x / n, y: y / n }
    }
    const [red, green, blue, yellow] = [at('red'), at('green'), at('blue'), at('yellow')]
    expect(red.x).toBeLessThan(green.x)
    expect(blue.x).toBeLessThan(yellow.x)
    expect(red.y).toBeLessThan(blue.y)
    expect(green.y).toBeLessThan(yellow.y)
    // Nearest sampling: four flat colours, not a blend between them (lighting is even across the flat quad).
    expect(colours.size).toBeLessThanOrEqual(8)
  })
})

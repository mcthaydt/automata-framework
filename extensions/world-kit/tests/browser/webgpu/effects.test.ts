// The kit's sky effects (stars, shafts, reflections, particles) through Pixi's WebGPU renderer, which `tests/browser/sky` does not
// reach (Chromium there has no WebGPU). Two things differ from WebGL2 and a WebGL2 case cannot show them:
// - Each WGSL source must compile. A compile error does not throw and does not reach `uncapturederror`: the pass's pipeline is
//   invalid and the frame goes black, so these cases read the shader modules' own compile messages.
// - Which way is up. `@pixi/3d` 0.1.0-beta.3 gives a post effect `uFxClip.w` negative where the view draws into a texture (always
//   on WebGPU) and `viewPos` Y up on every backend; a lamp's shaft, a flame, a star and a mirror must land where they belong.
// The scenes and the properties are those of the WebGL2 cases beside them. Two backends in one page do not work (Pixi's shared
// textures stay bound to the renderer that was destroyed), so each backend has its own file and asserts the properties itself.
//
// A machine with no WebGPU adapter (Pixi falls back to WebGL) cannot judge this: the cases return early, as `@automata/3d`'s skip.
import '@automata/3d/no-eval'
import { createPixi3dRenderer, DEFAULT_LOOK, type Pixi3dRenderer, timeOfDay } from '@automata/3d'
import { DEFAULT_PALETTE } from '@automata/content/palette'
import { CubeGeometry, FlatMaterial, Mesh3D, SphereGeometry } from '@pixi/3d'
import { afterEach, describe, expect, it } from 'vitest'
import { ParticlesEffect } from '#src/features/sky/particles-effect.ts'
import { RainEffect } from '#src/features/sky/rain-effect.ts'
import { ReflectEffect } from '#src/features/sky/reflect-effect.ts'
import { duelTriple } from '#src/features/sky/shader-parts.ts'
import { ShaftsEffect } from '#src/features/sky/shafts-effect.ts'
import { StarsEffect } from '#src/features/sky/stars-effect.ts'
import { colourAt, DUEL, drawn, SIZE, SKY, target } from '../sky/support.ts'

const frame = { alpha: 1, frameMs: 16, paused: false }
const WHITE = DEFAULT_PALETTE.colors.map((hex) => Number.parseInt(hex.slice(1), 16))

let open: { dispose(): void } | undefined
afterEach(() => {
  open?.dispose()
  open = undefined
  document.body.replaceChildren()
})

const backend = 'webgpu'

/** Whether the renderer really draws through WebGPU (Pixi falls back to WebGL where the machine has no adapter). */
const onWebGpu = (renderer: Pixi3dRenderer): boolean =>
  (renderer.stage.app.renderer as unknown as { name: string }).name === 'webgpu'

/**
 * The canvas's pixels as the last `draw` left them, top row first: a WebGPU canvas is copied into a 2D one in the task that
 * drew it, because its texture is gone after.
 */
function pixelsOf(renderer: Pixi3dRenderer): Uint8Array {
  const { canvas } = renderer.stage.app
  const copy = document.createElement('canvas')
  copy.width = canvas.width
  copy.height = canvas.height
  const g = copy.getContext('2d', { willReadFrequently: true })
  if (g === null) throw new Error('no 2D context')
  g.drawImage(canvas as unknown as CanvasImageSource, 0, 0)
  return new Uint8Array(g.getImageData(0, 0, copy.width, copy.height).data.buffer)
}

/** Draws the frames a case reads after a change, and returns the canvas. */
function shot(renderer: Pixi3dRenderer): Uint8Array {
  for (let i = 0; i < 4; i++) renderer.draw(frame)
  return pixelsOf(renderer)
}

/**
 * What the WebGPU device says about every shader module made from now on: a WGSL compile error does not throw or reach
 * `uncapturederror`, it leaves the pass's pipeline invalid and the frame black, so the module's own messages are the only report.
 */
function compileProblems(renderer: Pixi3dRenderer): { settle(): Promise<string[]> } {
  const found: string[] = []
  const pending: Promise<void>[] = []
  const device = (renderer.stage.app.renderer as unknown as { gpu?: { device?: GPUDevice } }).gpu?.device
  if (device !== undefined) {
    const create = device.createShaderModule.bind(device)
    device.createShaderModule = (descriptor) => {
      const module = create(descriptor)
      pending.push(
        module.getCompilationInfo().then((info) => {
          for (const m of info.messages)
            if (m.type === 'error')
              found.push(
                `line ${m.lineNum}: ${m.message} (${descriptor.code.split('\n')[m.lineNum - 1]?.trim().slice(0, 90)})`,
              )
        }),
      )
      return module
    }
  }
  return {
    settle: async () => {
      await Promise.all(pending)
      return found
    },
  }
}

/** A renderer on `backend` over `scene`, with `effect` made by `make` appended to the look, or `undefined` when the machine cannot judge. */
async function start<E extends { enabled: boolean }>(
  preference: 'webgpu',
  scene: Parameters<typeof createPixi3dRenderer>[0]['scene'],
  make: () => E,
  track = true,
): Promise<{ renderer: Pixi3dRenderer; effect: E; problems(): Promise<string[]> } | undefined> {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const made = await createPixi3dRenderer({
    logicalWidth: SIZE.width,
    logicalHeight: SIZE.height,
    backgroundColor: SKY,
    views: {},
    look: DEFAULT_LOOK,
    time: timeOfDay('night'),
    preference,
    scene,
  })(target(host))
  if (!made.ok) throw made.reason
  open = made.value
  if (!onWebGpu(made.value)) return undefined
  const problems = compileProblems(made.value)
  const effect = make()
  made.value.view.passes = [...made.value.view.passes, effect as never]
  // The view builds the camera's matrices as it draws, so the pass is told of the camera after a frame.
  made.value.draw(frame)
  if (track) (effect as unknown as { track?(camera: unknown): void }).track?.(made.value.view.camera)
  return { renderer: made.value, effect, problems: problems.settle }
}

const row = (i: number): number => Math.floor(i / SIZE.width)
const column = (i: number): number => i % SIZE.width
const meanRow = (mask: readonly number[]): number => mask.reduce((sum, i) => sum + row(i), 0) / mask.length

/** A sky of a ball low in the frame, and a camera looking level: the stars' scene. */
const skyScene: Parameters<typeof start>[1] = (view) => {
  view.camera.position.set(0, 1, 5)
  view.camera.lookAt({ x: 0, y: 1, z: 0 })
  const ball = new Mesh3D({
    geometry: new SphereGeometry(),
    material: new FlatMaterial({ baseColor: 0xffffff }),
  })
  ball.position.set(-1.5, -1.2, 0)
  ball.scale.set(0.2, 0.2, 0.2)
  view.root.addChild(ball)
  return undefined
}

/** A wall behind a camera at eye height: shafts and particles. */
const wallScene: Parameters<typeof start>[1] = (view) => {
  view.camera.position.set(0, 1, 5)
  view.camera.lookAt({ x: 0, y: 1, z: -3 })
  const wall = new Mesh3D({
    geometry: new CubeGeometry(),
    material: new FlatMaterial({ baseColor: 0x7a7799 }),
  })
  wall.position.set(0, 1, -3)
  wall.scale.set(40, 20, 0.1)
  view.root.addChild(wall)
  return undefined
}

/** A ball over a ground, seen from a little above: reflections. */
const groundScene: Parameters<typeof start>[1] = (view) => {
  view.camera.position.set(0, 1.5, 6)
  view.camera.lookAt({ x: 0, y: 0.4, z: 0 })
  const ground = new Mesh3D({
    geometry: new CubeGeometry(),
    material: new FlatMaterial({ baseColor: 0x3a4568 }),
  })
  ground.position.set(0, -0.05, 0)
  ground.scale.set(40, 0.1, 40)
  view.root.addChild(ground)
  const ball = new Mesh3D({
    geometry: new SphereGeometry(),
    material: new FlatMaterial({ baseColor: 0xffffff }),
  })
  ball.position.set(0, 1.2, 0)
  ball.scale.set(0.3, 0.3, 0.3)
  view.root.addChild(ball)
  return undefined
}

/** Disposes the renderer a case made, so the next starts clean. */
function close(): void {
  open?.dispose()
  open = undefined
  document.body.replaceChildren()
}

describe('the kit’s sky effects on WebGPU', () => {
  it('stars are DUEL colours in the sky above the horizon, and only there', async () => {
    const run = await start(backend, skyScene, () => new StarsEffect(1))
    if (run === undefined) return // no WebGPU adapter here
    run.effect.enabled = false
    const bare = shot(run.renderer)
    run.effect.enabled = true
    const lit = shot(run.renderer)
    expect(await run.problems(), 'WGSL compiles').toEqual([])
    const stars = drawn(bare, lit)
    expect(stars.length).toBeGreaterThan(5)
    expect(stars.every((i) => DUEL.has(colourAt(lit, i)))).toBe(true)
    // The camera looks level, so the horizon is the middle row: no star below it.
    expect(stars.every((i) => row(i) < SIZE.height / 2)).toBe(true)
  })

  it('a high lamp’s shaft is in the upper rows of the frame and a low lamp’s in the lower', async () => {
    const rows: number[] = []
    for (const y of [2, 0]) {
      const run = await start(backend, wallScene, () => new ShaftsEffect())
      if (run === undefined) return
      const bare = shot(run.renderer)
      run.effect.setLamps([
        { at: [0, y, -1], aim: [0, -1, 0], cone: 70, range: 6, colour: 0xffd59b, level: 1 },
      ])
      run.effect.track(run.renderer.view.camera)
      const moved = drawn(bare, shot(run.renderer))
      expect(await run.problems(), 'WGSL compiles').toEqual([])
      expect(moved.length, `lamp at ${y}`).toBeGreaterThan(10)
      rows.push(meanRow(moved))
      close()
    }
    expect(rows[0]).toBeLessThan((rows[1] ?? 0) - 3)
  })

  it('a puddle mirrors the ball below it, in the lower half of the frame, round its middle', async () => {
    const run = await start(backend, groundScene, () => new ReflectEffect({ ground: 0, puddles: 1 }))
    if (run === undefined) return
    run.effect.enabled = false
    const dry = shot(run.renderer)
    run.effect.enabled = true
    const wet = shot(run.renderer)
    expect(await run.problems(), 'WGSL compiles').toEqual([])
    const moved = drawn(dry, wet)
    expect(moved.every((i) => DUEL.has(colourAt(wet, i)))).toBe(true)
    const mirror = moved.filter((i) => colourAt(wet, i) === WHITE[6])
    expect(mirror.length).toBeGreaterThan(5)
    expect(mirror.every((i) => row(i) > SIZE.height / 2)).toBe(true)
    expect(mirror.every((i) => Math.abs(column(i) - SIZE.width / 2) < SIZE.width * 0.2)).toBe(true)
  })

  it('a flame sits where its emitter is: a high one in the upper rows, a low one in the lower, in the middle', async () => {
    const rows: number[] = []
    for (const y of [2, 0]) {
      const run = await start(
        backend,
        wallScene,
        () => new ParticlesEffect([{ kind: 'flame', at: [0, y, 0] }]),
      )
      if (run === undefined) return
      run.effect.enabled = false
      const bare = shot(run.renderer)
      run.effect.enabled = true
      const moved = drawn(bare, shot(run.renderer))
      expect(await run.problems(), 'WGSL compiles').toEqual([])
      expect(moved.length, `flame at ${y}`).toBeGreaterThan(6)
      expect(moved.every((i) => Math.abs(column(i) - SIZE.width / 2) < 12)).toBe(true)
      rows.push(meanRow(moved))
      close()
    }
    expect(rows[0]).toBeLessThan((rows[1] ?? 0) - 3)
  })

  it('the rain streaks fall in the open: a streak at a time, DUEL colours, and the clock moves them', async () => {
    const run = await start(backend, skyScene, () => new RainEffect(1, duelTriple('#88d6ff')))
    if (run === undefined) return
    run.effect.enabled = false
    const bare = shot(run.renderer)
    run.effect.enabled = true
    const a = shot(run.renderer)
    run.effect.clock = 0.4
    const b = shot(run.renderer)
    expect(await run.problems(), 'WGSL compiles').toEqual([])
    expect(drawn(bare, a).length).toBeGreaterThan(10)
    expect(drawn(a, b).length).toBeGreaterThan(10)
    expect(drawn(bare, b).every((i) => DUEL.has(colourAt(b, i)))).toBe(true)
  })
})

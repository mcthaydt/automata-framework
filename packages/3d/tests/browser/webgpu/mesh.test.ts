// A mesh drawn through Pixi's WebGPU renderer (WP0, 2026-11-10). AF's other WebGPU test draws the sky and no mesh, so
// `@pixi/3d`'s pipeline on WebGPU went unchecked: a lost device or a validation error on the first mesh frame showed
// only in a game. The `webgpu` project launches Chromium with WebGPU on (vitest.config.ts); a machine with no adapter
// skips these.
import '#src/entries/no-eval.ts'
import type { RenderRow, StepResult } from '@automata/sim'
import { DirectionalLight } from '@pixi/3d'
import { afterEach, describe, expect, it } from 'vitest'
import { createPixi3dRenderer, type Pixi3dRenderer } from '#src/app/create-renderer.ts'
import { drawWorld, sceneLamps } from '#src/app/world-view.ts'
import { BASE_PAIR, BASE_PAIR_SWATCHES } from '#src/features/figures/base/base-pair.ts'
import type { Gait } from '#src/features/figures/content/gait.schema.ts'
import { figure } from '#src/features/figures/view/figure-view.ts'
import { DEFAULT_LOOK } from '#src/features/look/look.ts'
import { baseLibrary } from '#src/features/world/base/base-library.ts'
import { BASE_SCENES } from '#src/features/world/base/base-scenes.ts'
import { buildWorld } from '#src/features/world/build.ts'
import { swatchColour } from '#src/features/world/swatches.ts'
import { sceneLightingSchema } from '#src/shared/render/light/scene-lighting.schema.ts'
import { box } from '#src/shared/render/views/box-view.ts'
import { mesh } from '#src/shared/render/views/mesh-view.ts'
import { levelTime } from '#src/shared/time-of-day/time-light.ts'
import { builtRenderer } from '#src/testing/built-renderer.ts'
import { encodeGlb, fixtureBox } from '#src/testing/model/model-fixtures.ts'
import { testTarget } from '#src/testing/test-target.ts'

const hasWebGpu =
  typeof navigator !== 'undefined' && 'gpu' in navigator
    ? (await (navigator as Navigator & { gpu: GPU }).gpu.requestAdapter().catch(() => null)) !== null
    : false

const frame = { alpha: 1, frameMs: 16, paused: false }
const step = (render: StepResult['render']): StepResult => ({ tick: 0, events: [], render, rejected: [] })
const rows: RenderRow[] = [
  { sid: 1, components: { crate: { x: -1, y: 0, z: 0 } } },
  { sid: 2, components: { prop: { x: 1, y: 0, z: 0 } } },
]

let scope: { dispose(): void } | undefined
afterEach(() => {
  scope?.dispose()
  scope = undefined
  document.body.replaceChildren()
})

interface Drawn {
  readonly renderer: Pixi3dRenderer
  /** What the GPU said went wrong: validation errors, and why the device was lost, if it was. */
  readonly problems: string[]
}

async function start(look: typeof DEFAULT_LOOK | undefined): Promise<Drawn> {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const target = testTarget(host, { 'models/box.glb': encodeGlb(fixtureBox()) })
  const factory = createPixi3dRenderer({
    preference: 'webgpu',
    logicalWidth: 160,
    logicalHeight: 90,
    backgroundColor: 0x2e222f,
    look,
    views: {
      crate: box({ width: 1, height: 1, depth: 1 }, { color: 0xf9c22b }),
      prop: mesh('models/box.glb', { height: 1 }),
    },
    scene: (view) => {
      view.camera.position.set(0, 2.5, 5)
      view.camera.lookAt({ x: 0, y: 0.5, z: 0 })
      const sun = new DirectionalLight({ intensity: 2 })
      sun.rotation.set(-0.8, 0.5, 0)
      view.root.addChild(sun)
      return undefined
    },
  })
  const renderer = await builtRenderer(factory(target))
  scope = renderer
  const problems: string[] = []
  const device = (renderer.stage.app.renderer as unknown as { gpu?: { device?: GPUDevice } }).gpu?.device
  device?.addEventListener('uncapturederror', (event) =>
    problems.push((event as GPUUncapturedErrorEvent).error.message),
  )
  void device?.lost.then((info) => problems.push(`device lost: ${info.reason}: ${info.message}`))
  return { renderer, problems }
}

/**
 * The canvas as it was presented, copied in the task that drew it (a WebGPU canvas keeps no drawing buffer past it).
 * `snapshot()` re-renders the stage into a texture for WebGPU, which reads back black on a software adapter.
 */
function presented(renderer: Pixi3dRenderer): Uint8ClampedArray {
  const canvas = renderer.stage.app.canvas as HTMLCanvasElement
  const copy = document.createElement('canvas')
  copy.width = canvas.width
  copy.height = canvas.height
  const context = copy.getContext('2d') as CanvasRenderingContext2D
  context.drawImage(canvas, 0, 0)
  return context.getImageData(0, 0, copy.width, copy.height).data
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

/** How many pixels are the crate's yellow (0xf9c22b) as the sun lights it: WebGL2 draws about 300 of them. */
function yellow(pixels: ArrayLike<number>): number {
  let count = 0
  for (let i = 0; i < pixels.length; i += 4)
    if (
      (pixels[i] ?? 0) > 100 &&
      (pixels[i] ?? 0) > (pixels[i + 1] ?? 0) &&
      (pixels[i + 1] ?? 0) > 2 * (pixels[i + 2] ?? 0)
    )
      count++
  return count
}

/** Frames the GPU gets to report in: a validation error or a lost device arrives a few frames after the draw. */
const settle = async (renderer: Pixi3dRenderer, frames = 12): Promise<void> => {
  for (let i = 0; i < frames; i++) {
    renderer.draw(frame)
    await new Promise((resolve) => requestAnimationFrame(resolve))
  }
}

describe.runIf(hasWebGpu)('a mesh on WebGPU', () => {
  for (const [name, look] of [
    ['without the look', undefined],
    ['with the look (the composite graph and its passes)', DEFAULT_LOOK],
    [
      'with the look and its outline (a post pass that reads depth)',
      { ...DEFAULT_LOOK, switches: { ...DEFAULT_LOOK.switches, outline: true } },
    ],
  ] as const)
    it(`draws a box and a model, and the device keeps working ${name}`, async () => {
      const { renderer, problems } = await start(look)
      expect(renderer.stage.app.renderer.name).toBe('webgpu')
      renderer.draw(frame)
      const empty = presented(renderer)
      renderer.apply(step({ resync: true, added: rows, changed: [], removed: [] }))
      renderer.draw(frame)
      const drawn = presented(renderer)
      // The box and the model cover a few hundred of the 160 × 90 field's pixels, as on WebGL2.
      expect(differing(empty, drawn)).toBeGreaterThan(200)
      // Lit, not black: the light tiles `@pixi/3d` culls lights with reach the shader as integers. The look snaps
      // colours to the palette, so only the unsnapped draw is checked for the crate's own yellow.
      if (look === undefined) expect(yellow(drawn), 'the crate lit yellow').toBeGreaterThan(200)
      await settle(renderer)
      expect(problems).toEqual([])
    }, 60_000)
})

// A figure is the mesh with the most in it: skinned parts re-skinned on the CPU each pose, decals, and a material
// tinted by the room's light every frame. It draws through the same graph as the crate, and the same device must
// survive it. One plain gait stands in for the content the base pair names.
const gait: Gait = {
  cycle: 0.46,
  speed: 3,
  stride: 0.6,
  duty: 0.54,
  lift: 0.065,
  bob: 0.05,
  crouch: 0.01,
  sway: 0.03,
  hipYaw: 0.09,
  hipRoll: 0.08,
  chestCounter: 0.5,
  lean: 0.03,
  heel: 0.24,
  push: 0.35,
  standOut: 0,
  standElbow: 0.36,
  armSwing: 0.5,
  armOut: 0.08,
  elbow: 0.45,
  elbowSwing: 0.45,
  armLag: 0.04,
  shoulderRoll: 0.75,
  headLevel: 0,
  headStabilize: 0.8,
  drag: 0,
  track: 0.3,
  spring: 0.6,
  chin: 0.04,
  stance: 0.045,
  stanceLead: 0.07,
  hang: 0.04,
  idleElbow: 0.3,
  reach: 1.4,
  poseRate: 12,
  walkPoses: 8,
  idlePoses: 8,
  turnRate: 0.785,
  twitch: 0,
  twitchEvery: 3,
  breath: 0.03,
  breathPeriod: 3.4,
  shift: 0.012,
  shiftPeriod: 5.5,
  headLead: 0.785,
}

describe.runIf(hasWebGpu)('a figure on WebGPU', () => {
  it('draws under a lamp with the look, and the device keeps working', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const { stand: _stand, ...def } = BASE_PAIR.man
    const factory = createPixi3dRenderer({
      preference: 'webgpu',
      logicalWidth: 160,
      logicalHeight: 90,
      backgroundColor: 0x2e222f,
      look: DEFAULT_LOOK,
      lighting: sceneLightingSchema.parse({
        ambient: 0.35,
        lamps: [{ id: 'lamp', x: 0, y: 2.4, z: 1, color: 0xffd9a0, strength: 1.5, range: 6 }],
      }),
      views: {
        man: figure(def, {
          library: { swatches: BASE_PAIR_SWATCHES, hair: {}, headwear: {}, items: {} },
          motion: {
            gaits: { loose: gait, bounce: gait },
            poses: {},
            clips: {},
            items: {},
            stands: {},
            rigs: {},
          },
        }),
      },
      scene: (view) => {
        view.camera.position.set(0, 1.2, 3.2)
        view.camera.lookAt({ x: 0, y: 1, z: 0 })
        return undefined
      },
    })
    const renderer = await builtRenderer(factory(testTarget(host)))
    scope = renderer
    const problems: string[] = []
    const device = (renderer.stage.app.renderer as unknown as { gpu?: { device?: GPUDevice } }).gpu?.device
    device?.addEventListener('uncapturederror', (event) =>
      problems.push((event as GPUUncapturedErrorEvent).error.message),
    )
    void device?.lost.then((info) => problems.push(`device lost: ${info.reason}: ${info.message}`))
    renderer.draw(frame)
    const empty = presented(renderer)
    renderer.apply(
      step({
        resync: true,
        added: [{ sid: 1, components: { man: { x: 0, y: 0, z: 0, yaw: 0 } } }],
        changed: [],
        removed: [],
      }),
    )
    renderer.draw(frame)
    // The figure covers about 390 pixels of the field, on WebGL2 and on WebGPU alike.
    expect(differing(empty, presented(renderer))).toBeGreaterThan(300)
    await settle(renderer)
    expect(problems).toEqual([])
  }, 60_000)
})

// The room the figures stand in: AF's base interior drawn by `drawWorld`, lit by its own lamp, with the look. The
// pieces that bake light and the ones a state can move (a door, a prop) take different materials, and a figure draws
// among them.
describe.runIf(hasWebGpu)('the base interior and a figure on WebGPU', () => {
  it('draws the room and the figure, and the device reports nothing', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const level = BASE_SCENES['base-interior']
    const time = levelTime(level.time)
    const world = buildWorld(level, baseLibrary, { night: time.name !== 'day' })
    const { stand: _stand, ...def } = BASE_PAIR.man
    const { stand: _stand2, ...womanDef } = BASE_PAIR.woman
    const motion = {
      gaits: { loose: gait, bounce: gait },
      poses: {},
      clips: {},
      items: {},
      stands: {},
      rigs: {},
    }
    const library = { swatches: BASE_PAIR_SWATCHES, hair: {}, headwear: {}, items: {} }
    const factory = createPixi3dRenderer({
      preference: 'webgpu',
      logicalWidth: 320,
      logicalHeight: 200,
      backgroundColor: 0x2e222f,
      look: DEFAULT_LOOK,
      time,
      lighting: sceneLightingSchema.parse({
        ambient: time.scene.light.ambient.level,
        lamps: sceneLamps(world.lamps, true),
      }),
      views: { man: figure(def, { library, motion }), woman: figure(womanDef, { library, motion }) },
      scene: (view, _stage, _occluders, light) => {
        view.camera.position.set(0, 1.6, 4)
        view.camera.lookAt({ x: 0, y: 1.2, z: 0 })
        drawWorld(
          {
            parent: view.root,
            colourOf: (swatch) => swatchColour(baseLibrary, swatch),
            look: DEFAULT_LOOK,
            light,
          },
          world.pieces,
        )
        return undefined
      },
    })
    const renderer = await builtRenderer(factory(testTarget(host)))
    scope = renderer
    const problems: string[] = []
    const device = (renderer.stage.app.renderer as unknown as { gpu?: { device?: GPUDevice } }).gpu?.device
    device?.addEventListener('uncapturederror', (event) =>
      problems.push((event as GPUUncapturedErrorEvent).error.message),
    )
    void device?.lost.then((info) => problems.push(`device lost: ${info.reason}: ${info.message}`))
    renderer.apply(
      step({
        resync: true,
        added: [
          { sid: 1, components: { man: { x: -0.6, y: 0, z: 0, yaw: 0 } } },
          { sid: 2, components: { woman: { x: 0.6, y: 0, z: 0, yaw: 0 } } },
        ],
        changed: [],
        removed: [],
      }),
    )
    await settle(renderer, 10)
    renderer.stage.app.renderer.resize(640, 400)
    await settle(renderer, 20)
    expect(problems).toEqual([])
  }, 60_000)
})

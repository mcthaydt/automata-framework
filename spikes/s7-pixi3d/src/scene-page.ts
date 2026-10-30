// Spike S7 (M3.1a): the @pixi/3d scene under AF's seams. Mounted through render-pixi's real `createPixiRenderer`
// setup(stage), with figures placed by render-pixi's real `RenderDeltaConsumer` over the View3D's Container3D root.
// `window.__s7` reports what the Playwright run (measure.ts) reads. The entries (main.ts, main-shim.ts) import
// render-pixi/no-eval before this module.

import { type EntityView, RenderDeltaConsumer } from '@mcthaydt/automata-render-pixi/delta'
import { createPixiRenderer } from '@mcthaydt/automata-render-pixi/renderer'
import type { RenderDelta, RenderRow, StepResult } from '@mcthaydt/automata-sim'
import { type Camera3D, DirectionalLight, Matrix4, View3D } from '@pixi/3d'
import { Effect, Scope } from 'effect'
import type { Container } from 'pixi.js'
import { measure, type Sliders } from './figure/genes.ts'
import { type Pose, restPose, type Skeleton, skeleton } from './figure/rig.ts'
import { windowTarget } from './mount/target.ts'
import { aimHead, reachArm } from './scene/aim.ts'
import { cameraPose, DEFAULT_VIEW, fovOf } from './scene/camera.ts'
import { type Clip, MARCH, sampleClip, WAVE } from './scene/clip.ts'
import { buildFigure, type FigureColors, type FigureView } from './scene/figure-view.ts'
import { buildProp, buildRoom } from './scene/room.ts'

interface CastMember {
  readonly sid: number
  readonly sliders: Partial<Sliders>
  readonly colors: FigureColors
  readonly at: readonly [number, number]
  readonly yaw: number
  readonly clip?: Clip
  readonly walk?: { readonly radius: number; readonly period: number }
  readonly aimAt?: number
}

// Endesga 64 colours. Figure 4 is the followed "player"; 1 and 2 play clips (2 walks a circle); 3 aims at 4.
const CAST: readonly CastMember[] = [
  {
    sid: 1,
    sliders: { height: 175, frame: 0.2 },
    colors: { skin: 0xf5a097, top: 0x1e6f50, legs: 0x3b2027, shoes: 0x131313 },
    at: [-2.6, 1.6],
    yaw: 0.5,
    clip: WAVE,
  },
  {
    sid: 2,
    sliders: { height: 158, frame: 0.85 },
    colors: { skin: 0xc28d75, top: 0xb4202a, legs: 0x323e4f, shoes: 0x2e222f },
    at: [2.2, 2.2],
    yaw: 0,
    clip: MARCH,
    walk: { radius: 1.3, period: 6 },
  },
  {
    sid: 3,
    sliders: { height: 168, frame: 0.5 },
    colors: { skin: 0x8a4836, top: 0xfa6a0a, legs: 0x4c3e24, shoes: 0x131313 },
    at: [-1.4, -0.6],
    yaw: 0.9,
    aimAt: 4,
  },
  {
    sid: 4,
    sliders: { height: 162, frame: 0.7 },
    colors: { skin: 0xf5a097, top: 0x249fde, legs: 0x3e3546, shoes: 0x2e222f },
    at: [0, 0],
    yaw: 0,
  },
  {
    sid: 5,
    sliders: { height: 185, frame: 0.1, muscle: 0.8 },
    colors: { skin: 0x5d2c28, top: 0x9babb2, legs: 0x3b2027, shoes: 0x131313 },
    at: [1.9, -0.9],
    yaw: -0.7,
  },
  {
    sid: 6,
    sliders: { height: 150, frame: 0.6, age: 0.9 },
    colors: { skin: 0xe8b796, top: 0x7a3045, legs: 0x4a5462, shoes: 0x2e222f },
    at: [-3.8, 3.6],
    yaw: 1.2,
  },
]

const TICK_HZ = 30

// Capture modes for the GPU-runner spec (M3.1b, e2e/gpu.e2e.ts), all off by default:
// - `still=<s>` holds one deterministic frame: the clips sampled at <s> seconds, the walker at that tick, no time
//   passing, so WebGL2 and WebGPU draw the same frame (S7-Q2) and a capture is repeatable;
// - `solo=<sid>` draws that figure alone (no room, no prop, no other figures), for its height in pixels (S7-Q10);
// - `figureX=<m>` moves the solo figure sideways while the camera keeps its focus, for the edge stretch (S7-Q10);
// - `key=1` clears to a key colour no figure or fogged surface uses, so the void and the figure can be counted;
// - `near=`, `far=` override the camera's clip planes, for the depth-precision pair (S7-Q10).
const params = new URLSearchParams(window.location.search)
const numberParam = (name: string): number | undefined =>
  params.has(name) ? Number(params.get(name)) : undefined
const STILL = numberParam('still')
const SOLO = numberParam('solo')
const FIGURE_X = numberParam('figureX') ?? 0
const KEY_COLOR = 0x00ff00
const CLEAR_COLOR = params.has('key') ? KEY_COLOR : 0x2e222f
const NEAR = numberParam('near') ?? 0.3
const FAR = numberParam('far') ?? 120
const cast = SOLO === undefined ? CAST : CAST.filter((member) => member.sid === SOLO)
const offsetX = (member: CastMember) => (member.sid === SOLO ? FIGURE_X : 0)
const errors: string[] = []
const report = {
  ready: false,
  renderer: '',
  webGLVersion: 0,
  gpu: '',
  resolution: 0,
  devicePixelRatio: window.devicePixelRatio,
  mode: {
    still: STILL ?? null,
    solo: SOLO ?? null,
    figureX: FIGURE_X,
    clear: CLEAR_COLOR,
    near: NEAR,
    far: FAR,
  },
  frames: 0,
  ticks: 0,
  fov: { lensMm: DEFAULT_VIEW.lensMm, fovOf: fovOf(DEFAULT_VIEW.lensMm), cameraFov: 0, projectionY: 0 },
  mount: { viewInWorld: false, worldIsStage: false },
  consumer: { added: false, moved: false, removed: false },
  propLoaded: false,
  errors,
}
;(window as unknown as { __s7: typeof report }).__s7 = report

interface FigureState {
  readonly member: CastMember
  readonly skeleton: Skeleton
  readonly view: FigureView
  readonly pose: Pose
  x: number
  z: number
  yaw: number
}

function walkerAt(member: CastMember, tick: number): { x: number; z: number; yaw: number } {
  if (!member.walk) return { x: member.at[0] + offsetX(member), z: member.at[1], yaw: member.yaw }
  const angle = ((tick / TICK_HZ) * 2 * Math.PI) / member.walk.period
  return {
    x: member.at[0] + offsetX(member) + Math.cos(angle) * member.walk.radius,
    z: member.at[1] + Math.sin(angle) * member.walk.radius,
    yaw: Math.atan2(-Math.sin(angle), Math.cos(angle)),
  }
}

const rowOf = (member: CastMember, tick: number): RenderRow => ({
  sid: member.sid,
  components: { figure: walkerAt(member, tick) },
})

const stepOf = (tick: number, render: RenderDelta): StepResult => ({ tick, events: [], render, rejected: [] })

async function main(): Promise<void> {
  const host = document.getElementById('game')!
  const figures = new Map<number, FigureState>()
  let view3d: View3D | undefined
  let consumer3d: RenderDeltaConsumer | undefined
  let time = STILL ?? 0

  // The figure views: what M3.4's `figure(def)` would be, behind render-pixi's EntityView. Container3D is not a
  // pixi Container (it extends EventEmitter), so the casts here are the seam S7-Q5 asks about.
  const figureView = (row: RenderRow): EntityView | undefined => {
    const member = CAST.find((m) => m.sid === row.sid)
    if (!member) return undefined
    const s = skeleton(measure(member.sliders).genes)
    const state: FigureState = {
      member,
      skeleton: s,
      view: buildFigure(s, member.colors),
      pose: restPose(),
      x: 0,
      z: 0,
      yaw: 0,
    }
    figures.set(member.sid, state)
    return {
      container: state.view.root as unknown as Container,
      update(curr, prev, alpha = 1) {
        const c = curr.figure!
        const p = prev?.figure ?? c
        const mix = (key: string) => (p[key] as number) + ((c[key] as number) - (p[key] as number)) * alpha
        state.x = mix('x')
        state.z = mix('z')
        state.yaw = c.yaw as number
      },
      destroy() {
        figures.delete(member.sid)
      },
    }
  }

  const factory = createPixiRenderer({
    backgroundColor: CLEAR_COLOR,
    pixelArt: false,
    setup(stage) {
      view3d = new View3D({
        autoResize: true,
        toneMapping: 'none',
        environment: { skyColor: 0xc7dcd0, groundColor: 0x3e3546 },
        fog: { type: 'linear', color: 0x2e222f, near: 9, far: 22 },
      })
      stage.world.addChild(view3d)
      report.mount.viewInWorld = view3d.parent === stage.world
      report.mount.worldIsStage = stage.world.parent === stage.app.stage
      const camera: Camera3D = view3d.camera
      camera.fov = fovOf(DEFAULT_VIEW.lensMm)
      camera.near = NEAR
      camera.far = FAR
      const sun = new DirectionalLight({ intensity: 2.2, color: 0xffeedd })
      sun.rotation.set(-0.9, 0.6, 0)
      view3d.root.addChild(sun)
      if (SOLO === undefined) buildRoom(view3d.root)
      consumer3d = new RenderDeltaConsumer(view3d.root as unknown as Container, { figure: figureView })
      return {
        apply(result) {
          consumer3d?.apply(result.render)
        },
        draw(frame) {
          consumer3d?.interpolate(frame.alpha)
          drawFigures(frame.frameMs / 1000)
        },
      }
    },
  })

  const drawFigures = (dt: number) => {
    time += dt
    const target = figures.get(4)
    for (const state of figures.values()) {
      const { member, pose, skeleton: s } = state
      const rest = restPose()
      pose.rot = rest.rot
      pose.shift = rest.shift
      pose.root = [state.x, 0, state.z]
      pose.yaw = state.yaw
      if (member.clip) sampleClip(member.clip, time, pose)
      if (member.aimAt !== undefined && target) {
        const head = [target.x, 1.55, target.z] as [number, number, number]
        aimHead(s, pose, head)
        reachArm(s, pose, 'R', [target.x, 1.2, target.z])
      }
      state.view.applyPose(pose)
    }
    if (view3d && target) {
      // The camera keeps its focus where the followed figure stands before any `figureX` shift.
      const focusX = target.x - offsetX(target.member)
      const { position, focus } = cameraPose({ x: focusX, y: 0, z: target.z }, DEFAULT_VIEW)
      view3d.camera.position.set(position.x, position.y, position.z)
      view3d.camera.lookAt(focus)
    }
  }

  const scope = Effect.runSync(Scope.make())
  const renderer = await Effect.runPromise(Scope.extend(factory(windowTarget(host)), scope))
  const app = renderer.stage.app
  report.renderer = app.renderer.name
  const gl = (app.renderer as unknown as { gl?: WebGL2RenderingContext }).gl
  if (gl) {
    report.webGLVersion = gl instanceof WebGL2RenderingContext ? 2 : 1
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    report.gpu = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER))
  } else if (app.renderer.name === 'webgpu') {
    // WebGPU: the adapter's own description (pixi keeps the adapter on `renderer.gpu`).
    const adapter = (app.renderer as unknown as { gpu?: { adapter?: { info?: Record<string, string> } } }).gpu
      ?.adapter
    const info = adapter?.info
    report.gpu = info
      ? [info.vendor, info.architecture, info.device, info.description].filter(Boolean).join(' | ')
      : 'webgpu (no adapter info)'
  } else {
    // pixi fell back to its Canvas renderer (no WebGL2, no WebGPU): no GPU draws the 3D view.
    report.gpu = `none (${app.renderer.name} renderer)`
  }
  report.resolution = app.renderer.resolution
  // S7-Q4: a capture through pixi's own `renderer.extract`, not the browser's screenshot.
  ;(window as unknown as { __s7extract: () => Promise<unknown> }).__s7extract = async () => {
    const { pixels, width, height } = app.renderer.extract.pixels(app.stage)
    let luma = 0
    let opaque = 0
    for (let i = 0; i < pixels.length; i += 4) {
      luma += 0.2126 * pixels[i]! + 0.7152 * pixels[i + 1]! + 0.0722 * pixels[i + 2]!
      if (pixels[i + 3]! > 0) opaque++
    }
    const png = await app.renderer.extract.base64({ target: app.stage, format: 'png' })
    return { width, height, meanLuma: luma / (width * height), opaqueShare: opaque / (width * height), png }
  }

  // S7-Q5: the consumer over Container3D adds, moves and removes an entity view.
  const probe = CAST[3]!
  renderer.apply(
    stepOf(0, {
      resync: false,
      added: [{ sid: 4, components: { figure: { x: 0.5, z: 0, yaw: 0 } } }],
      changed: [],
      removed: [],
    }),
  )
  report.consumer.added = figures.get(4)?.view.root.parent === view3d?.root
  renderer.apply(stepOf(0, { resync: false, added: [], changed: [rowOf(probe, 0)], removed: [] }))
  report.consumer.moved = figures.get(4)?.x === probe.at[0]
  const removedRoot = figures.get(4)?.view.root
  renderer.apply(stepOf(0, { resync: false, added: [], changed: [], removed: [4] }))
  report.consumer.removed = removedRoot?.parent === null && !figures.has(4)

  // The scene: a resync adds the cast, then each tick moves the walker.
  const firstTick = STILL === undefined ? 0 : Math.round(STILL * TICK_HZ)
  renderer.apply(
    stepOf(firstTick, {
      resync: true,
      added: cast.map((m) => rowOf(m, firstTick)),
      changed: [],
      removed: [],
    }),
  )
  const camera = view3d!.camera
  report.fov.cameraFov = camera.fov
  report.fov.projectionY = camera.computeProjection(16 / 9, new Matrix4()).elements[5]!

  const walkers = cast.filter((m) => m.walk)
  let tick = firstTick
  let carry = 0
  let last = performance.now()
  const frame = (now: number) => {
    if (STILL !== undefined) {
      // A held frame: nothing moves, so every draw is the same picture.
      renderer.draw({ alpha: 1, frameMs: 0, paused: false })
      report.frames++
      report.ticks = tick
      if (report.frames >= 30 && report.propLoaded) report.ready = true
      requestAnimationFrame(frame)
      return
    }
    const frameMs = Math.min(100, now - last)
    last = now
    carry += frameMs
    while (carry >= 1000 / TICK_HZ) {
      carry -= 1000 / TICK_HZ
      tick++
      renderer.apply(
        stepOf(tick, { resync: false, added: [], changed: walkers.map((m) => rowOf(m, tick)), removed: [] }),
      )
    }
    renderer.draw({ alpha: carry / (1000 / TICK_HZ), frameMs, paused: false })
    report.frames++
    report.ticks = tick
    if (report.frames >= 30 && report.propLoaded) report.ready = true
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
  if (SOLO === undefined) await buildProp(view3d!.root, './models/desk.glb', { x: 3.6, z: 3.8 }, 0.75)
  report.propLoaded = true
}

export function startScene(): void {
  window.addEventListener('error', (event) => errors.push(String(event.message)))
  window.addEventListener('unhandledrejection', (event) => errors.push(String(event.reason)))
  main().catch((error: unknown) => {
    errors.push(error instanceof Error ? `${error.name}: ${error.message}` : String(error))
    console.error(error)
  })
}

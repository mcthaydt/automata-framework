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
const errors: string[] = []
const report = {
  ready: false,
  renderer: '',
  webGLVersion: 0,
  gpu: '',
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
  if (!member.walk) return { x: member.at[0], z: member.at[1], yaw: member.yaw }
  const angle = ((tick / TICK_HZ) * 2 * Math.PI) / member.walk.period
  return {
    x: member.at[0] + Math.cos(angle) * member.walk.radius,
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
  let time = 0

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
    backgroundColor: 0x2e222f,
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
      camera.near = 0.3
      camera.far = 120
      const sun = new DirectionalLight({ intensity: 2.2, color: 0xffeedd })
      sun.rotation.set(-0.9, 0.6, 0)
      view3d.root.addChild(sun)
      buildRoom(view3d.root)
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
      const { position, focus } = cameraPose({ x: target.x, y: 0, z: target.z }, DEFAULT_VIEW)
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
  renderer.apply(stepOf(0, { resync: true, added: CAST.map((m) => rowOf(m, 0)), changed: [], removed: [] }))
  const camera = view3d!.camera
  report.fov.cameraFov = camera.fov
  report.fov.projectionY = camera.computeProjection(16 / 9, new Matrix4()).elements[5]!

  const walkers = CAST.filter((m) => m.walk)
  let tick = 0
  let carry = 0
  let last = performance.now()
  const frame = (now: number) => {
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
  await buildProp(view3d!.root, './models/desk.glb', { x: 3.6, z: 3.8 }, 0.75)
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

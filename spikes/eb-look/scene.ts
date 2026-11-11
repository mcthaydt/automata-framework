// Draws one base scene with @automata/3d as EnvironmentBuilder frames it (base/base.ts `views`), for shoot.mjs.
// ?scene=base-interior|base-exterior|base-interior-dressed|base-exterior-dressed  ?view=diorama|fp|af|tll  ?pref=webgl|webgpu
// `af` and `tll` are gameplay cameras on the first cast member, facing north as the diorama does: AF's default view
// (`CAMERA_DEFAULTS` and `LENS_MM`: 24 mm, 25° down, 5 m back, focus 1 m up) and The Last Light's play camera (50 mm, 30°
// home tilt, a zone's 16 m, look point 1.1 m up; mcthaydt/PixiJS3D_Experiment_001 `src/render/stage.ts`, its prologue
// hall and corridor zones), both at a 320 × 180 field.
// EB's diorama is orthographic, pitched down with no yaw, at PPM × density 2 texels a metre (96/2.6 × 2), centred on
// `at`; its first person is a 320 × 200 frame at a 90° horizontal field of view, `eye` m over the floor, facing `angle`
// (map degrees clockwise from east). Map space: x east, z south, y up.
import '@automata/3d/no-eval'
import {
  buildWorld,
  createPixi3dRenderer,
  HazeEffect,
  SkyEffect,
  DEFAULT_LOOK,
  drawWorld,
  figure,
  levelTime,
  render3dExtension,
  sceneLamps,
  sceneLightingSchema,
  swatchColour,
  type View3dFactory,
} from '@automata/3d'
import { BASE_PAIR, BASE_PAIR_SWATCHES, BASE_SCENES, baseLibrary } from '@automata/3d/base'
import type { Gait } from '@automata/3d/figures'
import { defineComponent, defineGame, definePlugin, startGame } from '@automata/framework'
import { dressedBaseScenes, worldKitExtension, worldKitLibrary } from '@automata/world-kit'
import { detectVideoAlphaMode, isWebGLSupported } from 'pixi.js'

// Pixi's capability probes each make a throwaway WebGL context and lose it on purpose. On headless SwiftShader that
// loss also ends the page's WebGPU instance ("A valid external Instance reference no longer exists"), so a WebGPU
// game dies when it enters play. Both cache their answer: asked once here, before any renderer, they never run again.
isWebGLSupported()
await detectVideoAlphaMode()

const q = new URLSearchParams(location.search)
const name = q.get('scene') ?? 'base-interior'
const VIEWS = ['diorama', 'fp', 'af', 'tll'] as const
const viewName = VIEWS.find((v) => v === q.get('view')) ?? 'diorama'
const GAMEPLAY = {
  af: { lensMm: 24, tiltDeg: 25, distance: 5, focus: 1 },
  tll: { lensMm: 50, tiltDeg: 30, distance: 16, focus: 1.1 },
} as const
const pref = q.get('pref') === 'webgpu' ? 'webgpu' : 'webgl'
// Bisecting switches (all on by default): ?look=0 drops the look, ?cast=0 the figures, ?light=0 the baked room light.
const on = (key: string) => q.get(key) !== '0'
const look = on('look') ? DEFAULT_LOOK : undefined

const dressed = name.endsWith('-dressed')
const level =
  (BASE_SCENES as Record<string, (typeof BASE_SCENES)['base-interior']>)[name] ??
  (dressedBaseScenes as Record<string, (typeof BASE_SCENES)['base-interior']>)[name]
if (level === undefined) throw new Error(`no scene ${name}`)
const library = dressed ? worldKitLibrary : baseLibrary
const time = levelTime(level.time)
const night = time.name !== 'day'
const world = buildWorld(level, library, { night })
const lighting = sceneLightingSchema.parse({
  ambient: time.scene.light.ambient.level,
  lamps: sceneLamps(world.lamps, night),
})
const views = (level.views ?? {}) as Record<string, Record<string, unknown>>
const size =
  viewName === 'fp'
    ? { width: 320, height: 200 }
    : viewName === 'af' || viewName === 'tll'
      ? { width: 320, height: 180 }
      : { width: Number(views.diorama?.w ?? 512), height: Number(views.diorama?.h ?? 320) }

// The base pair stand still. AF's base pair names the `loose` and `bounce` gaits and two stands, which only compiled
// content holds; the spike gives one plain gait under both names and no stand.
const loose: Gait = {
  cycle: 0.46, speed: 3, stride: 0.6, duty: 0.54, lift: 0.065, bob: 0.05, crouch: 0.01,
  sway: 0.03, hipYaw: 0.09, hipRoll: 0.08, chestCounter: 0.5, lean: 0.03,
  heel: 0.24, push: 0.35, standOut: 0, standElbow: 0.36,
  armSwing: 0.5, armOut: 0.08, elbow: 0.45, elbowSwing: 0.45, armLag: 0.04, shoulderRoll: 0.75,
  headLevel: 0, headStabilize: 0.8, drag: 0, track: 0.3, spring: 0.6, chin: 0.04,
  stance: 0.045, stanceLead: 0.07, hang: 0.04, idleElbow: 0.3, reach: 1.4,
  poseRate: 12, walkPoses: 8, idlePoses: 8, turnRate: 0.785, twitch: 0, twitchEvery: 3,
  breath: 0.03, breathPeriod: 3.4, shift: 0.012, shiftPeriod: 5.5, headLead: 0.785,
}
const motion = { gaits: { loose, bounce: loose }, poses: {}, clips: {}, items: {}, stands: {}, rigs: {} }
const figureLibrary = { swatches: BASE_PAIR_SWATCHES, hair: {}, headwear: {}, items: {} }

const cast = on('cast') ? (level.cast ?? []) : []
const Cast = defineComponent('cast', { i: 'f32', x: 'f32', y: 'f32', z: 'f32', yaw: 'f32' })
const castView: View3dFactory = (row, id, models, light) => {
  const index = Math.round(Number(row.components[Cast.id]?.i ?? 0))
  const member = cast[index]
  if (member === undefined) return undefined
  const { stand: _stand, ...def } = BASE_PAIR[member.who as 'man' | 'woman']
  const view = figure(def, { library: figureLibrary, motion })(row, id, models, light)
  if (view === undefined) return undefined
  const update = view.update
  // EB's angle is map degrees clockwise from east; AF's yaw 0 faces +z (south).
  const yaw = ((90 - (member.angle ?? 90)) * Math.PI) / 180
  return {
    ...view,
    update(...args) {
      update?.(...args)
      view.container.position.set(member.at[0], member.at[2] ?? 0, member.at[1])
      view.container.rotation.y = yaw
    },
  }
}

const sky = time.scene.sky
const skyMid = sky[Math.floor(sky.length / 2)]?.colour ?? '#808080'

const game = defineGame({
  id: 'eb-look-baseline',
  size,
  sim: {
    plugins: [definePlugin({ name: 'cast', defs: [Cast] })],
    seed: 1,
    setup: (sim) => {
      cast.forEach((_, i) => void sim.spawn([[Cast, { i, x: 0, y: 0, z: 0, yaw: 0 }]]))
    },
  },
  extensions: dressed ? [render3dExtension, worldKitExtension] : [render3dExtension],
  createRenderer: (options) =>
    createPixi3dRenderer({
      ...options,
      preference: pref === 'webgpu' ? 'webgpu' : 'webgl',
      look,
      time,
      lighting: on('light') ? lighting : undefined,
      backgroundColor: Number.parseInt(skyMid.slice(1), 16),
      views: { [Cast.id]: castView },
      scene: (view, stage, occluders, light) => {
        const camera = view.camera
        if (viewName === 'diorama') {
          const d = views.diorama ?? {}
          const at = (d.at as [number, number, number]) ?? [0, 1, 0]
          const pitch = (Number(d.pitch ?? 18) * Math.PI) / 180
          const ppm = (96 / 2.6) * 2
          camera.mode = 'orthographic'
          camera.orthographicSize = size.width / 2 / ppm
          camera.near = 0.1
          camera.far = 200
          const back = 40
          camera.position.set(at[0], at[1] + Math.sin(pitch) * back, at[2] + Math.cos(pitch) * back)
          camera.lookAt({ x: at[0], y: at[1], z: at[2] })
        } else if (viewName === 'af' || viewName === 'tll') {
          const g = GAMEPLAY[viewName]
          const who = cast[0]?.at ?? [0, 0]
          const focus = { x: who[0], y: g.focus, z: who[1] }
          const tilt = (g.tiltDeg * Math.PI) / 180
          camera.fov = (2 * Math.atan(12 / g.lensMm) * 180) / Math.PI
          camera.near = 0.2
          camera.far = 200
          camera.position.set(focus.x, focus.y + g.distance * Math.sin(tilt), focus.z + g.distance * Math.cos(tilt))
          camera.lookAt(focus)
        } else {
          const f = views.fp ?? {}
          const at = (f.at as [number, number]) ?? [0, 0]
          const eye = Number(f.eye ?? 1.6)
          const a = (Number(f.angle ?? 0) * Math.PI) / 180
          // 90° across 320 px is 2·atan(tan 45° · 200/320) ≈ 64° up the 200.
          camera.fov = (2 * Math.atan(Math.tan(Math.PI / 4) * (size.height / size.width)) * 180) / Math.PI
          camera.near = 0.05
          camera.far = 200
          camera.position.set(at[0], eye, at[1])
          camera.lookAt({ x: at[0] + Math.cos(a), y: eye, z: at[1] + Math.sin(a) })
        }
        // The haze counts from the focus: the frame's middle in the orthographic diorama, the man in the gameplay views, 3 m
        // from the eye in first person (the profile's `focusFp`).
        const haze = view.passes.find((p): p is HazeEffect => p instanceof HazeEffect)
        if (viewName === 'diorama') haze?.focusCentre()
        else if (viewName === 'af' || viewName === 'tll') haze?.focus(GAMEPLAY[viewName].distance)
        // The sky panorama replaces the flat background where no mesh draws: the time's bands, clouds and the level's
        // horizon, turned with the camera (heading clockwise from east, pitch up positive).
        if (on('sky')) {
          const sky = new SkyEffect(
            time,
            (level.sky?.horizon ?? []).map((layer) => ({
              kind: layer.kind,
              colour: `#${(swatchColour(library, layer.swatch) ?? 0x7a7799).toString(16).padStart(6, '0')}`,
              height: layer.height,
              seed: layer.seed,
            })),
          )
          if (viewName === 'fp') sky.aim((Number(views.fp?.angle ?? 0) * Math.PI) / 180, 0)
          else if (viewName === 'af' || viewName === 'tll')
            sky.aim(-Math.PI / 2, -(GAMEPLAY[viewName].tiltDeg * Math.PI) / 180)
          view.passes = [sky, ...view.passes]
        }
        view.environment = { skyColor: 0xcdd2da, groundColor: 0x3b303c }
        const colourOf = (swatch: string) => swatchColour(library, swatch)
        drawWorld({ parent: view.root, occluders: viewName === 'fp' ? undefined : occluders, colourOf, look, light }, world.pieces)
        const renderer = stage.app.renderer as unknown as { name: string }
        const { dataset } = stage.app.canvas
        dataset.renderer = renderer.name
        dataset.pieces = String(world.pieces.length)
        dataset.problems = String(world.problems.length)
        dataset.lamps = String(lighting.lamps.length)
        dataset.time = time.name
        // Why a WebGPU device goes, for the gap: the renderer's own watch shows only "the picture stopped".
        const device = (stage.app.renderer as unknown as { gpu?: { device?: GPUDevice } }).gpu?.device
        void device?.lost.then((info) => {
          dataset.lost = `${info.reason}: ${info.message} (at ${Math.round(performance.now())} ms)`
        })
        device?.addEventListener('uncapturederror', (event) => {
          dataset.gpuError = String((event as GPUUncapturedErrorEvent).error.message).slice(0, 300)
        })
        dataset.readyAt = String(Math.round(performance.now()))
        dataset.ready = "1"
        return undefined
      },
    }),
})

startGame(game)

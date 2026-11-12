// Draws one base scene through the default gameplay camera (`camera:` on the renderer, the rig and driver as a game gets
// them), with the player standing in the middle of the room, at one of the eight 45° headings.
// ?scene=base-interior|base-exterior  ?step=0..7 (each step is 45° of heading, as the player's Q and R turn it)
//   &distance=<m> an authored distance for the view instead of the default 16 m.
import '@automataframework/3d/no-eval'
import {
  box,
  buildWorld,
  createPixi3dRenderer,
  DEFAULT_LOOK,
  drawWorld,
  levelTime,
  render3dExtension,
  sceneLamps,
  sceneLightingSchema,
  swatchColour,
} from '@automataframework/3d'
import { baseLibrary, BASE_SCENES } from '@automataframework/3d/base'
import { CameraHeading, cameraView, enterView, MAX_CAMERA_TURN, START } from '@automataframework/3d/sim'
import { defineComponent, defineGame, definePlugin, startGame } from '@automataframework/framework'
import { detectVideoAlphaMode, isWebGLSupported } from 'pixi.js'

// Pixi's capability probes each make a throwaway WebGL context and lose it on purpose: ask once, before any renderer.
isWebGLSupported()
await detectVideoAlphaMode()

const q = new URLSearchParams(location.search)
const name = (q.get('scene') ?? 'base-interior') as keyof typeof BASE_SCENES
const step = Number(q.get('step') ?? 0)
const level = BASE_SCENES[name]
if (level === undefined) throw new Error(`no scene ${name}`)
const time = levelTime(level.time)
const night = time.name !== 'day'
const world = buildWorld(level, baseLibrary, { night })
const lighting = sceneLightingSchema.parse({
  ambient: time.scene.light.ambient.level,
  lamps: sceneLamps(world.lamps, night),
})
const diorama = (level.views?.diorama ?? {}) as { at?: [number, number, number]; w?: number; h?: number }
const at = diorama.at ?? [0, 1, 0]
const size = { width: Number(diorama.w ?? 512), height: Number(diorama.h ?? 320) }
const distance = q.get('distance')
const VIEW = cameraView('play', distance === null ? {} : { distance: Number(distance) })

const Body = defineComponent('body', { x: 'f32', y: 'f32', z: 'f32' })
const sky = time.scene.sky
const skyMid = sky[Math.floor(sky.length / 2)]?.colour ?? '#808080'

startGame(
  defineGame({
    id: 'tll-camera',
    size,
    sim: {
      plugins: [definePlugin({ name: 'player', defs: [Body] })],
      seed: 1,
      setup: (sim) => {
        sim.spawn([
          [Body, { x: at[0], y: 0, z: at[2] }],
          [CameraHeading, { ...enterView(START, VIEW, { x: 0, y: 0 }), heading: step * MAX_CAMERA_TURN }],
        ])
      },
    },
    extensions: [render3dExtension],
    createRenderer: (options) =>
      createPixi3dRenderer({
        ...options,
        look: DEFAULT_LOOK,
        time,
        lighting,
        backgroundColor: Number.parseInt(skyMid.slice(1), 16),
        // A stand-in for the player, 1.62 m tall: the camera follows it.
        views: { [Body.id]: box({ width: 0.5, height: 1.62, depth: 0.3 }, { color: 0xffbc4e }) },
        camera: { views: [VIEW], initial: VIEW.id, follow: Body.id },
        scene: (view, stage, occluders, light) => {
          view.environment = { skyColor: 0xcdd2da, groundColor: 0x3b303c }
          drawWorld(
            { parent: view.root, occluders, colourOf: (swatch) => swatchColour(baseLibrary, swatch), look: DEFAULT_LOOK, light },
            world.pieces,
          )
          const { dataset } = stage.app.canvas
          dataset.renderer = (stage.app.renderer as unknown as { name: string }).name
          dataset.scene = name
          dataset.step = String(step)
          dataset.headingDeg = String(step * 45)
          dataset.distance = String(VIEW.distance)
          dataset.ready = '1'
          return undefined
        },
      }),
  }),
)

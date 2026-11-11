// Draws the converted clinic (content/, from convert.ts) with @automata/3d, in the opening state: the power out, the
// lamp levels of the opening from content/clinic.opening-state.json, and one of the eleven frames of the brief.
//   ?frame=zone-hall|zone-corridor|zone-closet|play-hall|play-ward|play-corridor|play-supply
//   &turned=1   the play camera turned one 45° step (the player's Q)     &pref=webgl|webgpu
// A zone still is a zone's authored camera (its distance, looking at its look point) with nothing in frame; a play frame
// is the play camera following a stand-in for the player (1.62 m tall) at one of the baseline's spots.
import '@automata/3d/no-eval'
import {
  box,
  buildWorld,
  createPixi3dRenderer,
  DEFAULT_LOOK,
  drawWorld,
  HazeEffect,
  levelTime,
  render3dExtension,
  swatchColour,
  worldLighting,
} from '@automata/3d'
import { CameraHeading, cameraView, enterView, MAX_CAMERA_TURN, START } from '@automata/3d/sim'
import { defineComponent, defineGame, definePlugin, startGame } from '@automata/framework'
import { detectVideoAlphaMode, isWebGLSupported } from 'pixi.js'
import clinic from './content/clinic.af-sector.json'
import library from './content/clinic.library.json'
import opening from './content/clinic.opening-state.json'

// Pixi's capability probes each make a throwaway WebGL context and lose it on purpose: ask once, before any renderer.
isWebGLSupported()
await detectVideoAlphaMode()

const q = new URLSearchParams(location.search)
const frame = q.get('frame') ?? 'play-hall'
const turned = q.get('turned') === '1'
const pref = q.get('pref') === 'webgpu' ? 'webgpu' : 'webgl'
const views = clinic.views as unknown as Record<string, Record<string, unknown>>

// Which camera zone each baseline spot is in (the source's `zoneAt`: the supply room and the corridor are carved out of the hall).
const ZONE: Record<string, string> = { hall: 'hall', ward: 'hall', corridor: 'corridor', supply: 'closet' }
const [kind, name] = frame.split('-') as ['zone' | 'play', string]
const zone = views[kind === 'zone' ? name : (ZONE[name] as string)] as { look: number[]; distance: number }
const spot = views[`spot-${name}`] as { at: number[] } | undefined
const focus = kind === 'zone' ? { x: zone.look[0] as number, z: zone.look[2] as number } : { x: spot?.at[0] ?? 0, z: spot?.at[1] ?? 0 }

const time = levelTime(clinic.time)
const world = buildWorld(clinic as never, library as never, { night: true })
const lighting = worldLighting(world, time, { states: opening.lamps })
const size = { width: 1024, height: 768 }
const VIEW = cameraView('play', { distance: zone.distance })
const Body = defineComponent('body', { x: 'f32', y: 'f32', z: 'f32' })
const sky = time.scene.sky
const skyMid = sky[Math.floor(sky.length / 2)]?.colour ?? '#808080'

startGame(
  defineGame({
    id: 'clinic-frames',
    size,
    sim: {
      plugins: [definePlugin({ name: 'player', defs: [Body] })],
      seed: 1,
      setup: (sim) => {
        sim.spawn([
          [Body, { x: focus.x, y: 0, z: focus.z }],
          [CameraHeading, { ...enterView(START, VIEW, { x: 0, y: 0 }), heading: turned ? MAX_CAMERA_TURN : 0 }],
        ])
      },
    },
    extensions: [render3dExtension],
    createRenderer: (options) =>
      createPixi3dRenderer({
        ...options,
        preference: pref,
        look: DEFAULT_LOOK,
        time,
        lighting,
        backgroundColor: Number.parseInt(skyMid.slice(1), 16),
        // A stand-in for the player, nothing at all in a zone still.
        views: {
          [Body.id]: box(kind === 'zone' ? { width: 0.01, height: 0.01, depth: 0.01 } : { width: 0.5, height: 1.62, depth: 0.3 }, { color: 0xffbc4e }),
        },
        camera: { views: [VIEW], initial: VIEW.id, follow: Body.id },
        scene: (view, stage, occluders, light, models) => {
          view.environment = { skyColor: 0xcdd2da, groundColor: 0x3b303c }
          view.passes.find((p): p is HazeEffect => p instanceof HazeEffect)?.focus(VIEW.distance)
          drawWorld(
            { parent: view.root, occluders, colourOf: (swatch) => swatchColour(library as never, swatch), look: DEFAULT_LOOK, light, models },
            world.pieces,
          )
          const { dataset } = stage.app.canvas
          dataset.renderer = (stage.app.renderer as unknown as { name: string }).name
          dataset.frame = frame
          dataset.pieces = String(world.pieces.length)
          dataset.problems = String(world.problems.length)
          dataset.problemCodes = [...new Set(world.problems.map((p) => p.code))].join(',')
          dataset.lamps = String(lighting.lamps.length)
          dataset.ready = '1'
          return undefined
        },
      }),
  }),
)

// Draws the converted clinic (content/, from convert.ts) with @automata/3d, in the opening state: the power out, the
// lamp levels of the opening from content/clinic.opening-state.json, and one of the eleven frames of the brief.
//   ?frame=zone-hall|zone-corridor|zone-closet|play-hall|play-ward|play-corridor|play-supply
//   &turned=1   the play camera turned one 45° step (the player's Q)     &pref=webgl|webgpu
// A zone still is a zone's authored camera (its distance, looking at its look point) with nothing in frame; a play frame
// is the play camera following a stand-in for the player (1.62 m tall) at one of the baseline's spots.
import '@automata/3d/no-eval'
// Loading the world kit registers the prop generators the dressing's presets name (moon shafts, pipes, plaques, curtains…).
import '@automata/world-kit'
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
import { readLevel } from '@automata/3d/level'
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
// Bisecting switches: ?look=0 drops the look, ?light=0 the baked light, ?occ=0 the camera's occluder rule, ?walls=0 leaves out the walls.
const on = (key: string) => q.get(key) !== '0'
// ?haze=0 switches the look's distance haze off.
const LOOK = q.get('haze') === '0' ? { ...DEFAULT_LOOK, switches: { ...DEFAULT_LOOK.switches, haze: false } } : DEFAULT_LOOK
const pref = q.get('pref') === 'webgpu' ? 'webgpu' : 'webgl'
const views = clinic.views as unknown as Record<string, Record<string, unknown>>

// Which camera zone each baseline spot is in (the source's `zoneAt`: the supply room and the corridor are carved out of the hall).
const ZONE: Record<string, string> = { hall: 'hall', ward: 'hall', corridor: 'corridor', supply: 'closet' }
const [kind, name] = frame.split('-') as ['zone' | 'play', string]
const zone = views[kind === 'zone' ? name : (ZONE[name] as string)] as { look: number[]; distance: number }
const spot = views[`spot-${name}`] as { at: number[] } | undefined
const focus = kind === 'zone' ? { x: zone.look[0] as number, z: zone.look[2] as number } : { x: spot?.at[0] ?? 0, z: spot?.at[1] ?? 0 }

// ?ambient=<level> and ?fill=<level> try another room light without regenerating the level.
const base = levelTime(clinic.time)
const light = base.scene.light
const time = q.has('ambient') || q.has('fill')
  ? { ...base, scene: { ...base.scene, light: { ...light, ambient: { ...light.ambient, level: Number(q.get('ambient') ?? light.ambient.level) }, fill: { ...light.fill, level: Number(q.get('fill') ?? light.fill.level) } } } }
  : base
// A level is read as a game reads it (a bare height becomes a plane) before it is built.
const read = readLevel(clinic)
if (read.problems.length > 0) throw new Error(read.problems.map((p) => p.message).join('; '))
const world = buildWorld(read.level, library as never, { night: true })
const lighting = worldLighting(world, time, { states: opening.lamps })
const size = { width: 1024, height: 768 }
// The zone as a camera view, with the source's room bounds (the box its sectors span) so the room follow clamps as it does there.
const ZONE_ID = kind === 'zone' ? name : (ZONE[name] as string)
const corners = clinic.sectors.filter((sector) => sector.zone === ZONE_ID).flatMap((sector) => sector.corners.map(([x, z]) => [x as number, z as number]))
const bounds = { min: [Math.min(...corners.map((c) => c[0] as number)), 0, Math.min(...corners.map((c) => c[1] as number))], max: [Math.max(...corners.map((c) => c[0] as number)), 6, Math.max(...corners.map((c) => c[1] as number))] } as const
const VIEW = cameraView(ZONE_ID, { ...(zone as object), bounds } as never)
// The player's heading: the home heading from `START`, one 45° step on for the turned frames.
const HEADING = { ...enterView(START, VIEW, { x: 0, y: 0 }) }
if (turned) HEADING.heading += MAX_CAMERA_TURN
const Body = defineComponent('body', { x: 'f32', y: 'f32', z: 'f32' })
const sky = time.scene.sky
const skyMid = sky[Math.floor(sky.length / 2)]?.colour ?? '#808080'

startGame(
  defineGame({
    id: 'clinic-frames',
    size,
    // The source's baselines have no bars: the framework's default 5% letterbox bars would crop the frame.
    renderer: { barFraction: 0 },
    sim: {
      plugins: [definePlugin({ name: 'player', defs: [Body] })],
      seed: 1,
      setup: (sim) => {
        sim.spawn([
          [Body, { x: focus.x, y: 0, z: focus.z }],
          [CameraHeading, HEADING],
        ])
      },
    },
    extensions: [render3dExtension],
    createRenderer: (options) =>
      createPixi3dRenderer({
        ...options,
        preference: pref,
        look: on('look') ? LOOK : undefined,
        time,
        lighting: on('light') ? lighting : undefined,
        backgroundColor: Number.parseInt(skyMid.slice(1), 16),
        // A stand-in for the player, nothing at all in a zone still.
        views: {
          [Body.id]: box(kind === 'zone' ? { width: 0.01, height: 0.01, depth: 0.01 } : { width: 0.5, height: 1.62, depth: 0.3 }, { color: 0xffbc4e }),
        },
        // The play camera is the sim-driven rig: it follows the stand-in for the player through the zone's own view (its look,
        // follow, depth follow and skew), turned by the heading the player starts at.
        camera: { views: [VIEW], initial: VIEW.id, follow: Body.id },
        scene: (view, stage, occluders, light, models) => {
          view.environment = { skyColor: 0xcdd2da, groundColor: 0x3b303c }
          ;(window as unknown as { __camera: unknown }).__camera = view.camera
          view.passes.find((p): p is HazeEffect => p instanceof HazeEffect)?.focus(VIEW.distance)
          drawWorld(
            { parent: view.root, occluders: on('occ') ? occluders : undefined, colourOf: (swatch) => swatchColour(library as never, swatch), look: on('look') ? LOOK : undefined, light, models },
            world.pieces.filter((p) => (on('walls') || p.part !== 'wall') && (on('tops') || !p.id.includes(':top:'))),
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

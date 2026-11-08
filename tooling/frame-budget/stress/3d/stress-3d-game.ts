import {
  buildWorld,
  createPixi3dRenderer,
  DEFAULT_LOOK,
  drawWorld,
  figure,
  render3dExtension,
  swatchColour,
  targetSize,
  type View3dFactory,
  type WorldLibrary,
} from '@automata/3d'
import { readLevel } from '@automata/3d/level'
import { CameraHeading, cameraView, enterView, START, turnCamera } from '@automata/3d/sim'
import {
  type DefinedGame,
  defineComponent,
  defineGame,
  definePlugin,
  defineSystem,
} from '@automata/framework'
import { library, motion, wick } from './wick.ts'

// The 3D look's stress scene, the one the 3D frame-budget projects measure: Wick walking a loop round a hall under
// the pixel-art look with every core pass on, while the camera turns, so every frame moves the whole picture.

const world: WorldLibrary = {
  swatches: {
    floor: { ramp: 'dusk', step: 4 },
    wall: { ramp: 'dusk', step: 1 },
    ceiling: { ramp: 'dusk', step: 0 },
  },
}

const HALL = {
  format: 'af-sector/2',
  name: 'hall',
  sectors: [
    {
      id: 'hall',
      floor: 0,
      ceiling: 3,
      // A sector with no light is drawn black: the vertex light multiplies the colour.
      light: 1,
      corners: [
        [-5, -4],
        [5, -4],
        [5, 4],
        [-5, 4],
      ],
      floorTexture: 'floor',
      ceilingTexture: 'ceiling',
      wallTexture: 'wall',
    },
  ],
}

const Hero = defineComponent('hero', { x: 'f32', y: 'f32', z: 'f32', yaw: 'f32', walking: 'bool' })

/** Camera units a tick: a full turn in about 10 seconds at 60 ticks a second (a turn is 65,536 units). */
const TURN_UNITS = 109

// A 4 m square at 1 m/s, one side every 240 ticks, never stopping, so the figure is always mid-stride.
const walk = defineSystem('walk', (ctx) => {
  const lap = ctx.tick % 960
  const side = Math.floor(lap / 240)
  const along = ((lap % 240) / 240) * 4
  const [x, z, yaw] = [
    [-2 + along, -2, 1.5708],
    [2, -2 + along, 0],
    [2 - along, 2, -1.5708],
    [-2, 2 - along, 3.1416],
  ][side] as [number, number, number]
  for (const hero of ctx.query(Hero, CameraHeading)) {
    hero.set(Hero, { x, z, yaw, walking: true })
    hero.set(CameraHeading, turnCamera(hero.get(CameraHeading), TURN_UNITS))
  }
})

const loop = definePlugin({ name: 'stress-3d', defs: [Hero, walk] })
const FOLLOW = cameraView('follow')

/**
 * `factory` that tells `report` how long the figure took from being asked for to its first pose, in milliseconds:
 * the figure's meshes are built when the view is made, and its first `update` poses it.
 */
export function timedFirstPose(factory: View3dFactory, report: (ms: number) => void): View3dFactory {
  const timed: View3dFactory = (row, componentId, models, light) => {
    const started = performance.now()
    const view = factory(row, componentId, models, light)
    if (view === undefined) return view
    let posed = false
    return {
      ...view,
      update: (curr, prev, alpha) => {
        view.update?.(curr, prev, alpha)
        if (posed) return
        posed = true
        report(performance.now() - started)
      },
    }
  }
  return timed
}

/** The stress scene as a game; `onFirstPose` hears the first figure's pose time. */
export function stress3dGame(onFirstPose: (ms: number) => void): DefinedGame {
  return defineGame({
    id: 'af-stress-3d',
    size: targetSize({ width: 844, height: 390 }, DEFAULT_LOOK.pixel.short),
    sim: {
      plugins: [loop],
      seed: 1,
      setup: (sim) =>
        void sim.spawn([
          [Hero, { x: -2, y: 0, z: -2, yaw: 1.5708, walking: true }],
          [CameraHeading, enterView(START, FOLLOW, { x: 0, y: 0 })],
        ]),
    },
    extensions: [render3dExtension],
    createRenderer: (options) =>
      createPixi3dRenderer({
        ...options,
        look: DEFAULT_LOOK,
        views: {
          [Hero.id]: timedFirstPose(
            figure(wick, { library, motion, state: (c) => ({ moving: c[Hero.id]?.walking === true }) }),
            onFirstPose,
          ),
        },
        camera: { views: [FOLLOW], initial: FOLLOW.id, follow: Hero.id },
        scene: (view, _stage, occluders) => {
          view.environment = { skyColor: 0xcdd2da, groundColor: 0x3b303c }
          const colourOf = (swatch: string) => swatchColour(world, swatch)
          drawWorld(
            { parent: view.root, occluders, colourOf, look: DEFAULT_LOOK },
            buildWorld(readLevel(HALL).level, world).pieces,
          )
          return undefined
        },
      }),
  })
}

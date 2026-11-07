// cutscenes-reach-cue: a man walks across a floor and, at a set time, a cue makes him reach
//
// Shows: an actor's path and a cue in a cutscene script (`@automata/cutscenes`). The director places the man at t
//   seconds (his x, z, facing and whether he is walking) and calls the game's `startClip` once as the scene passes
//   the cue's time, however the scene is played; the figure view plays that clip over the walk. The man is a puppet:
//   the sim only holds his row and counts ticks, and the view stands him where the director says.
// Controls: none
// Packages: @automata/framework, @automata/3d, @automata/cutscenes
// Difficulty: ★★★☆
// Tier: extension
import '@automata/3d/no-eval'
import { createPixi3dRenderer, figure, render3dExtension, type View3dFactory } from '@automata/3d'
import { BASE_PAIR, BASE_PAIR_SWATCHES } from '@automata/3d/base'
import type { FigureClipDef, Gait, MotionLibrary } from '@automata/3d/figures'
import { createDirector, type SceneState } from '@automata/cutscenes/director'
import type { PlacedScript } from '@automata/cutscenes/sim'
import { defineComponent, defineGame, definePlugin } from '@automata/framework'

// --- figure ---
// The base man with the `bounce` gait (as in figures-walk) and a `reach` clip: the right arm fades to `reach-out` and
// back. A game writes these in content; here they are inline, written as compiled.
const stride = { cycle: 0.46, speed: 3, stride: 0.6, duty: 0.54, lift: 0.065, bob: 0.05, crouch: 0.01 }
const hips = { sway: 0.03, hipYaw: 0.09, hipRoll: 0.08, chestCounter: 0.5, lean: 0.03 }
const arms = { armSwing: 0.5, armOut: 0.08, elbow: 0.45, elbowSwing: 0.45, armLag: 0.04, shoulderRoll: 0.75 }
const feet = { heel: 0.24, push: 0.35, standOut: 0, standElbow: 0.36 }
const head = { headLevel: 0, headStabilize: 0.8, drag: 0, track: 0.3, spring: 0.6, chin: 0.04 }
const stand = { stance: 0.045, stanceLead: 0.07, hang: 0.04, idleElbow: 0.3, reach: 1.4 }
const clock = { poseRate: 12, walkPoses: 8, idlePoses: 8, turnRate: 0.785, twitch: 0, twitchEvery: 3 }
const breath = { breath: 0.03, breathPeriod: 3.4, shift: 0.012, shiftPeriod: 5.5, headLead: 0.785 }
const bounce: Gait = { ...stride, ...hips, ...arms, ...feet, ...head, ...stand, ...clock, ...breath }
const key = (t: number, pose: string, ease?: 'inOut') => ({ t, pose, ease })
const reach: FigureClipDef = {
  ...{ length: 1.6, loop: 'once', mask: ['armR', 'torso'] },
  keys: [key(0, 'free'), key(0.5, 'reach-out', 'inOut'), key(1.1, 'reach-out'), key(1.6, 'free', 'inOut')],
}
const handOut = { handR: { pos: [-0.1275, 1.1114, 0.5] } } as const
const poses = { free: { effectors: {} }, 'reach-out': { effectors: handOut } } as const
const motion: MotionLibrary = { gaits: { bounce }, poses, clips: { reach }, items: {}, stands: {}, rigs: {} }
const { stand: _arms_crossed, ...man } = BASE_PAIR.man

// --- script ---
// Seconds. The man walks from the left to the middle between 1 s and 4 s; at 4 s the cue starts `reach`.
const script: PlacedScript = {
  id: 'reach-cue',
  duration: 6,
  camera: [{ t: 0, pos: [0, 1.5, 4.5], look: [0, 1, 0] }],
  actor: [
    { who: 'man', t: 1, x: -2, z: 0, facing: Math.PI / 2, moving: true },
    { who: 'man', t: 4, x: 0, z: 0, facing: Math.PI / 2 },
  ],
  cues: [{ at: 4, who: 'man', clip: 'reach' }],
}

// --- sim ---
const Man = defineComponent('man', { x: 'f32', y: 'f32', z: 'f32', yaw: 'f32' })

// --- game ---
let seconds = 0
let scene: SceneState | undefined
let action: { id: string; startedAt: number; count: number } | undefined
const director = createDirector(script, (_who, id, startedAt) => {
  action = { id, startedAt, count: (action?.count ?? 0) + 1 }
})
const walker = figure(
  { ...man, gait: 'bounce' },
  {
    library: { swatches: BASE_PAIR_SWATCHES, hair: {}, headwear: {}, items: {} },
    motion,
    now: () => seconds,
    state: () => ({ moving: scene?.actors.man?.moving === true, action }),
  },
)
// The man stands where the director puts him; his row only says that he exists.
const puppet: View3dFactory = (row, id, models, light) => {
  const view = walker(row, id, models, light)
  if (view === undefined) return undefined
  const update = view.update
  return {
    ...view,
    update(...args) {
      update?.(...args)
      const at = scene?.actors.man
      if (at === undefined) return
      view.container.position.set(at.x, 0, at.z)
      view.container.rotation.y = at.facing
    },
  }
}

export default defineGame({
  id: 'cutscenes-reach-cue',
  size: { width: 320, height: 180 },
  sim: {
    plugins: [definePlugin({ name: 'stage', defs: [Man] })],
    seed: 1,
    setup: (sim) => void sim.spawn([[Man, { x: 0, y: 0, z: 0, yaw: 0 }]]),
  },
  extensions: [render3dExtension],
  createRenderer: (options) =>
    createPixi3dRenderer({
      ...options,
      backgroundColor: 0x2f3f38,
      views: { [Man.id]: puppet },
      scene: (view, stage, occluders) => {
        view.environment = { skyColor: 0xcdd2da, groundColor: 0x3b303c }
        occluders.box({ min: [-4, -0.1, -4], max: [4, 0, 4] }, 0x8690b2)
        view.camera.position.set(0, 1.5, 4.5)
        view.camera.lookAt({ x: 0, y: 1, z: 0 })
        return {
          apply: (result) => {
            seconds = Math.min(result.tick / 60, script.duration)
            scene = director.stateAt(seconds)
            const { dataset } = stage.app.canvas
            dataset.cutscene = scene.done ? 'done' : 'playing'
            dataset.clip = action?.id ?? ''
            dataset.cues = String(action?.count ?? 0)
          },
        }
      },
    }),
})

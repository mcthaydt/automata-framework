// figures-aim: Wick turning his head, chest and right hand to follow an orb circling him
//
// Shows: aim as data the sim gives (a point and the parts that turn to it, a weight each); the view turns the point
//   into the figure's own frame and solves the aim every frame, over the idle; the rig's limits stop the head and
//   chest turning past their range, so they hold at the edge while the orb passes behind him.
// Controls: none
// Packages: @automata/framework, @automata/figures, @automata/render-pixi3d
// Difficulty: ★★★☆
// Tier: core
import '@automata/render-pixi3d/no-eval'
import type { FigureDef, MotionLibrary } from '@automata/figures'
import { defineComponent, defineGame, definePlugin, defineSystem } from '@automata/framework'
import { box, createPixi3dRenderer, figure, render3dExtension } from '@automata/render-pixi3d'

// Wick, his swatches and the `bounce` gait as in figures-walk (FigureBuilder a1f7246), written as compiled.
const cloak = { 'wick-cloak': { colour: 41 }, 'wick-cloak-shade': { colour: 40 } }
const trim = { 'wick-trim': { colour: 24, gloss: 0.9 }, 'wick-boot': { colour: 17 } }
const shade = { 'wick-shadow': { colour: 15, flat: true }, 'wick-eye': { colour: 32, flat: true } }
const face = { sole: { colour: 15, flat: true }, lid: { colour: 10, flat: true } }
const brows = { brow: { colour: 17, flat: true }, mouth: { colour: 18, flat: true } }
const swatches = { ...cloak, ...trim, ...shade, ...face, ...brows }
const library = { swatches, hair: {}, headwear: {}, items: {} }
const stride = { cycle: 0.46, speed: 3, stride: 0.6, duty: 0.54, lift: 0.065, bob: 0.05, crouch: 0.01 }
const hips = { sway: 0.03, hipYaw: 0.09, hipRoll: 0.08, chestCounter: 0.5, lean: 0.03 }
const feet = { heel: 0.24, push: 0.35 }
const arms = { armSwing: 0.5, armOut: 0.08, elbow: 0.45, elbowSwing: 0.45, armLag: 0.04, shoulderRoll: 0.75 }
const head = { headLevel: 0, headStabilize: 0.8, drag: 0, track: 0.3, spring: 0.6, chin: 0.04 }
const stand = { stance: 0.045, stanceLead: 0.07, hang: 0.04, idleElbow: 0.3, standOut: 0.04, reach: 1.4 }
const clock = { poseRate: 12, walkPoses: 8, idlePoses: 8, turnRate: 0.785, twitch: 0, twitchEvery: 3 }
const breath = { breath: 0.03, breathPeriod: 3.4, shift: 0.012, shiftPeriod: 5.5, headLead: 0.785 }
const bounce = { ...stride, ...hips, ...feet, ...arms, ...head, ...stand, ...clock, ...breath }
const features = { eyes: 'wick-eye', lids: 'lid', brows: 'brow', mouth: 'mouth' }
const boots = { shoes: 'wick-boot', boots: true, sole: 'sole' }
const cape = { cape: 'wick-cloak', length: 0.9, trim: 'wick-trim' }
const top = { top: 'wick-cloak', sleeves: 'long', cuffs: 'wick-trim' } as const
const wick: FigureDef = {
  ...{ skin: 'wick-shadow', gait: 'bounce', hand: 'R', default: 'wanderer' },
  sliders: { height: 120, head: 1, chunk: 1, frame: 0.4, legs: 0.2, posture: 0.6, hands: 0.6, feet: 0.6 },
  outfits: { wanderer: [top, { trousers: 'wick-cloak-shade' }, boots, cape, features] },
}
const motion: MotionLibrary = { gaits: { bounce }, poses: {}, clips: {}, items: {}, stands: {}, rigs: {} }

// Wick's feet and facing, and the orb's: the orb's position is also where Wick looks.
const place = { x: 'f32', y: 'f32', z: 'f32', yaw: 'f32' } as const
const Hero = defineComponent('hero', { ...place, atX: 'f32', atZ: 'f32' })
const Orb = defineComponent('orb', place)
const HEAD_HEIGHT = 1.1

// Around a 2 m square about Wick at head height, a side every 1.5 s (90 ticks): before him, his left, behind, his
// right.
const orbit = defineSystem('orbit', (ctx) => {
  const lap = ctx.tick % 360
  const along = ((lap % 90) / 90) * 2 - 1
  const [x, z] = [
    [along, 1],
    [1, -along],
    [-along, -1],
    [-1, along],
  ][Math.floor(lap / 90)] as [number, number]
  for (const orb of ctx.query(Orb)) orb.set(Orb, { x, z })
  for (const hero of ctx.query(Hero)) hero.set(Hero, { atX: x, atZ: z })
})

// The head and the right hand point at the orb (in world metres: the view turns them into Wick's frame), the chest
// half way.
const watching = (hero?: Readonly<Record<string, unknown>>) => {
  const at: [number, number, number] = [Number(hero?.atX), HEAD_HEIGHT, Number(hero?.atZ)]
  return {
    moving: false,
    aim: [
      { part: 'head', at },
      { part: 'chest', at, weight: 0.5 },
      { part: 'handR', at },
    ],
  } as const
}

export default defineGame({
  id: 'figures-aim',
  size: { width: 320, height: 180 },
  sim: {
    plugins: [definePlugin({ name: 'aim', defs: [Hero, Orb, orbit] })],
    seed: 1,
    setup: (sim) => {
      sim.spawn([[Hero, { x: 0, y: 0, z: 0, yaw: 0, atX: -1, atZ: 1 }]])
      sim.spawn([[Orb, { x: -1, y: HEAD_HEIGHT, z: 1, yaw: 0 }]])
    },
  },
  extensions: [render3dExtension],
  createRenderer: (options) =>
    createPixi3dRenderer({
      ...options,
      backgroundColor: 0x193c3e,
      views: {
        [Hero.id]: figure(wick, { library, motion, state: (c) => watching(c[Hero.id]) }),
        [Orb.id]: box({ width: 0.12, height: 0.12, depth: 0.12 }, { color: 0xe43b44 }),
      },
      // A fixed camera 3.4 m in front at shoulder height, looking at the chest: the orb shows behind him, and his eyes
      //   (a pixel each) still read; from much higher they hide under his brow and his front reads as his back.
      scene: (view, _stage, occluders) => {
        view.camera.position.set(0, 1.4, 3.4)
        view.camera.lookAt({ x: 0, y: 0.9, z: 0 })
        view.environment = { skyColor: 0xc7dcd0, groundColor: 0x3e3546 }
        occluders.box({ min: [-3, -0.1, -3], max: [3, 0, 3] }, 0x8b9bb4)
        return undefined
      },
    }),
})

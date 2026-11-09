// characterkit-hair: three figures seen from behind, each in a hairstyle built from the character kit's pieces
//
// Shows: hairstyles as data (`@automata/character-kit`): a style is a list of pieces and a finish. Core draws a hairstyle
//   as locks; the kit adds the pieces a bun, braided rows and a ponytail are built from (`scalp`, `bun`, `rows`, `tail`)
//   and the finishes that light them (`sleek`, `braid`). Naming the kit in the game's `extensions` is all it takes; a
//   style naming a bun without it is refused in words ("There is no hair piece called bun"). Here each style is
//   written inline in the figure's hair garment; a game keeps its styles in `figure-hair` content.
// Controls: none
// Packages: @automata/framework, @automata/3d, @automata/character-kit
// Difficulty: ★★★☆
// Tier: extension
import '@automata/3d/no-eval'
import { createPixi3dRenderer, figure, render3dExtension } from '@automata/3d'
import { BASE_PAIR, BASE_PAIR_SWATCHES } from '@automata/3d/base'
import type { FigureDef, FigureLibrary, Gait, HairStyle, MotionLibrary } from '@automata/3d/figures'
import { figuresExtension } from '@automata/3d/figures'
import { characterKitExtension } from '@automata/character-kit'
import { defineComponent, defineGame, definePlugin } from '@automata/framework'

// --- figure ---
// The `bounce` gait (as in figures-walk), which a standing figure breathes and shifts by.
const stride = { cycle: 0.46, speed: 3, stride: 0.6, duty: 0.54, lift: 0.065, bob: 0.05, crouch: 0.01 }
const hips = { sway: 0.03, hipYaw: 0.09, hipRoll: 0.08, chestCounter: 0.5, lean: 0.03 }
const arms = { armSwing: 0.5, armOut: 0.08, elbow: 0.45, elbowSwing: 0.45, armLag: 0.04, shoulderRoll: 0.75 }
const feet = { heel: 0.24, push: 0.35, standOut: 0, standElbow: 0.36 }
const head = { headLevel: 0, headStabilize: 0.8, drag: 0, track: 0.3, spring: 0.6, chin: 0.04 }
const stand = { stance: 0.045, stanceLead: 0.07, hang: 0.04, idleElbow: 0.3, reach: 1.4 }
const clock = { poseRate: 12, walkPoses: 8, idlePoses: 8, turnRate: 0.785, twitch: 0, twitchEvery: 3 }
const breath = { breath: 0.03, breathPeriod: 3.4, shift: 0.012, shiftPeriod: 5.5, headLead: 0.785 }
const bounce: Gait = { ...stride, ...hips, ...arms, ...feet, ...head, ...stand, ...clock, ...breath }
const motion: MotionLibrary = { gaits: { bounce }, poses: {}, clips: {}, items: {}, stands: {}, rigs: {} }
const library: FigureLibrary = { swatches: BASE_PAIR_SWATCHES, hair: {}, headwear: {}, items: {} }

// --- styles ---
// The hairline the pieces start from: a path over the skull as (angle round the head, how high), brow to nape.
const angles = [0, 0.45, 0.85, 1.15, 1.35, 1.6, 1.9, 2.3, 3.1416]
const height = [0.6, 0.58, 0.44, 0.28, 0.22, 0.24, 0.2, -0.3, -0.55]
const from = angles.map((angle, i): [number, number] => [angle, height[i] ?? 0])
const high = [0, 0.95, -0.35] // where the ponytail is tied
const scalp = (lift: number, edge: number) => ({ scalp: { from, lift, edge } })
const knot = { at: [0, 1.15, -0.2], r: 0.5, turns: 2.3, rope: { r: 0.16, flat: 0.85 }, tie: true }
const plait = { r: 0.14, plait: 0.25, tip: 'blunt', taper: 0.8 }
const braids = { count: 5, span: 1.4, from, to: high, lift: 0.02, matte: true, rope: { r: 0.24, flat: 0.55 } }
const pony = {
  at: high,
  count: 7,
  matte: true,
  rise: 0.2,
  length: 0.95,
  spread: [0.2, 0.6],
  tie: true,
  rope: plait,
}
const rows = {
  count: 5,
  span: 0.9,
  from,
  to: 'nape',
  nape: [[0, -0.5]],
  lift: 0.05,
  matte: true,
  rope: plait,
}
const styles: Record<string, HairStyle> = {
  bun: { finish: 'sleek', pieces: [scalp(0.035, 0.4), { bun: knot }] },
  braids: { finish: 'braid', pieces: [scalp(0.03, 0.5), { rows: braids }, { tail: pony }] },
  cornrows: { finish: 'braid', pieces: [scalp(0.02, 0.5), { rows }] },
}

// The base pair's bodies and faces, each in one style (the hair garment's style replaces the pair's cropped cut).
const { stand: _arms_crossed, ...man } = BASE_PAIR.man
const { stand: _hand_on_hip, ...woman } = BASE_PAIR.woman
const wearing = (def: FigureDef, style?: HairStyle): FigureDef => ({
  ...def,
  gait: 'bounce',
  outfits: { base: (def.outfits.base ?? []).map((g) => ('hair' in g ? { ...g, style } : g)) },
})
const people: Record<string, FigureDef> = {
  bun: wearing(man, styles.bun),
  braids: wearing(woman, styles.braids),
  cornrows: wearing(man, styles.cornrows),
}

// --- sim ---
// Where each figure stands (metres, y up) and which way it faces: away from the camera, so the hair shows.
const place = { x: 'f32', y: 'f32', z: 'f32', yaw: 'f32' } as const
const kinds = Object.keys(people).map((name) => defineComponent(name, place))

// --- game ---
export default defineGame({
  id: 'characterkit-hair',
  size: { width: 320, height: 180 },
  sim: {
    plugins: [definePlugin({ name: 'stand', defs: kinds })],
    seed: 1,
    setup: (sim) => {
      for (const [i, kind] of kinds.entries())
        sim.spawn([[kind, { x: (i - 1) * 0.8, y: 0, z: 0, yaw: Math.PI }]])
    },
  },
  extensions: [render3dExtension, figuresExtension, characterKitExtension],
  createRenderer: (options) =>
    createPixi3dRenderer({
      ...options,
      backgroundColor: 0x2f3f38,
      views: Object.fromEntries(
        kinds.map((kind) => [
          kind.id,
          figure(people[kind.id] as FigureDef, { library, motion, now: () => performance.now() / 1000 }),
        ]),
      ),
      scene: (view, _stage, occluders) => {
        view.camera.position.set(0, 1.55, 2.4)
        view.camera.lookAt({ x: 0, y: 1.45, z: 0 })
        view.environment = { skyColor: 0xcdd2da, groundColor: 0x3b303c }
        occluders.box({ min: [-3, -0.1, -3], max: [3, 0, 3] }, 0x8690b2)
        return undefined
      },
    }),
})
